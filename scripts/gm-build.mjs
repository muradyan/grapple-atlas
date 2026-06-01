// Curate + enrich the GrappleMap graph into game data (src/data/grapplemap.json).
// Input: scripts/gm-graph.json (from gm-extract.mjs). No network.
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const g = JSON.parse(readFileSync('scripts/gm-graph.json', 'utf8'))
const nodesById = Object.fromEntries(g.nodes.map((n) => [n.id, n]))
const transById = Object.fromEntries(g.trans.map((t) => [t.id, t]))

// Geometry-decoded "who controls" per node (scripts/gm-roles.mjs): { id: {p0top, conf} }.
// p0top = is RED (player0 = you) the controlling grappler here. conf = how clear.
const p0roles = JSON.parse(readFileSync('scripts/p0roles.json', 'utf8'))
// Authoritative per-transition player-swap flags (scripts/gm-extract-joints.mjs):
// { id: {fromSwap, toSwap} }. Identity flips across an edge iff fromSwap !== toSwap.
const swaps = JSON.parse(readFileSync('scripts/gm-swaps.json', 'utf8'))
// Per-transition keyframes (baked for the renderer's natural-motion animation).
const allFrames = JSON.parse(readFileSync('scripts/gm-frames.json', 'utf8'))

// Above this confidence (or any dominant position) one grappler clearly controls,
// so advancing moves are gated to the top role. Below it (symmetric standing
// scrambles, conf ~0.0–0.09) the position is contested and open to both.
const CONTROL_CONF = 0.15

// ---- curation: connected beginner no-gi subgraph, BFS from standing ----
const CORE = new Set([
  'standing', 'combat_base', 'full_guard', 'closed_guard', 'open_guard',
  'half_guard', 'side_control', 'mount', 'back', 'turtle', 'butterfly',
  'north_south', 'knee_on_belly', '5050_guard', 'deep_half', 'x_guard',
  'single_leg_takedown', 'double_leg_takedown', 'sprawl',
])
const coreOk = (n) => n.tags.some((t) => CORE.has(t))
const okIds = new Set(g.nodes.filter(coreOk).map((n) => n.id))
// drop MMA strikes — this is a grappling game
const STRIKE_RE = /strike|punch|kick|roundhouse|teep|jab|uppercut|hammerfist|superman|flying.?knee|\bslam\b|\bmma\b|ground.?and.?pound|elbow.?from|knee.?to|head.?kick|leg.?kick/
const isStrike = (t) => STRIKE_RE.test((t.name || '').toLowerCase() + ' ' + t.tags.join(' '))
const edges = g.trans.filter((t) => okIds.has(t.from) && okIds.has(t.to) && !isStrike(t))
const adj = {}
for (const t of edges) {
  ;(adj[t.from] ||= []).push(t.to)
  ;(adj[t.to] ||= []).push(t.from)
}
const starts = g.nodes.filter((n) => n.tags.includes('standing') && okIds.has(n.id)).map((n) => n.id)
const seen = new Set(starts)
const q = [...starts]
while (q.length) {
  const c = q.shift()
  for (const x of adj[c] || []) if (!seen.has(x)) { seen.add(x); q.push(x) }
}
// Expand by one hop so every reached position keeps ALL of its real outgoing
// moves (their targets were otherwise filtered out, leaving "only one option").
const expanded = new Set(seen)
for (const id of seen) {
  for (const o of nodesById[id].out || []) {
    const tr = transById[o.t]
    if (!tr || isStrike(tr)) continue
    expanded.add(tr.from)
    expanded.add(tr.to)
  }
}
const subNodeIds = expanded
const subEdges = g.trans.filter((t) => !isStrike(t) && expanded.has(t.from) && expanded.has(t.to))

// ---- readable names (GrappleMap leaves many as "...") ----
const POS_LABEL = {
  back: 'back control', mount: 'mount', side_control: 'side control',
  north_south: 'north-south', knee_on_belly: 'knee on belly', half_guard: 'half guard',
  closed_guard: 'closed guard', full_guard: 'closed guard', open_guard: 'open guard',
  butterfly: 'butterfly guard', turtle: 'turtle', combat_base: 'combat base',
  '5050_guard': '50/50', standing: 'standing',
}
const mainPos = (node) => {
  for (const k of Object.keys(POS_LABEL)) if (node.tags.includes(k)) return POS_LABEL[k]
  return 'the position'
}
// short, always-meaningful label for a node (used to name "to X" reverse moves)
const posLabel = (node) => {
  const mp = mainPos(node)
  if (mp !== 'the position') return mp
  const tag = node.tags.find((t) => !/^(top_|bottom_)/.test(t)) || node.tags[0]
  return tag ? tag.replace(/_/g, ' ') : 'scramble'
}
// "?" (GrappleMap's placeholder for an empty description), dots/ellipsis, or blank.
const isJunk = (s) => !s || /^[?.…\s]+$/.test(s.trim())
// transName takes the RESOLVED target name (string) so "?"/bare transitions become
// "transition to {real position}" instead of a meaningless "?".
function transName(t, type, targetName) {
  const raw = (t.name || '').trim()
  if (!isJunk(raw)) return raw
  const known = targetName && !isJunk(targetName) && targetName !== 'transitional position'
  switch (type) {
    case 'submission': return 'submission attempt'
    case 'pass': return known ? `pass to ${targetName}` : 'guard pass'
    case 'sweep': return 'sweep'
    case 'takedown': return 'takedown'
    case 'escape': return 'escape'
    case 'backtake': return 'take the back'
    case 'control': return 'establish control'
    default: return known ? `transition to ${targetName}` : 'transition'
  }
}

// ---- derive node attributes ----
const txt = (s) => (s || '').toLowerCase()
function dominance(node) {
  const t = node.tags
  const has = (x) => t.includes(x)
  if (has('back')) return 7
  if (has('mount')) return 6
  if (has('knee_on_belly')) return 5
  if (has('side_control')) return 5
  if (has('north_south')) return 4
  if (has('turtle')) return 3
  if (has('half_guard')) return 2
  return 0 // guards, standing, butterfly, 50/50 = neutral-ish
}
const NEUTRAL = new Set(['standing']) // no clear top/bottom
function asymmetric(node) {
  return !node.tags.some((x) => NEUTRAL.has(x))
}

// ---- derive transition attributes ----
// Specific submission names only — NOT a bare "lock" (matched "blocks",
// "lockdown") and NOT "tap"/"finish" (too generic).
const SUB_RE = /choke|strangle|kimura|americana|key.?lock|armbar|arm.?bar|triangle|rear.?naked|\brnc\b|guillotine|omoplata|ezekiel|kneebar|knee.?bar|heel.?hook|toe.?hold|ankle.?lock|wrist.?lock|leg.?lock|d.?arce|anaconda|crucifix|bow.?and.?arrow|bicep.?slic|calf.?slic|twister|necktie|neck.?crank|can.?opener|cravat/
// guard against false positives (control positions that contain a sub keyword)
const NOTSUB_RE = /block|lockdown|body.?triangle|deadlock|interlock|grapevine/
const SWEEP_RE = /sweep|reversal|\broll\b|come.?up|hip.?bump|flower|scissor|elevator|lumberjack|tomoe/
const PASS_RE = /pass|knee.?slice|knee.?cut|toreando|stack|smash|leg.?drag|over.?under|float|matador|long.?step/
const ESCAPE_RE = /escape|recover|shrimp|granby|wrestle.?up|stand.?up|replace.?guard|frame|bridge|upa|elbow.?knee|get.?up|posture/
const TAKEDOWN_RE = /takedown|throw|double.?leg|single.?leg|trip|duck.?under|ankle.?pick|sprawl|shot|snap.?down|arm.?drag.*back|fireman/
const BACKTAKE_RE = /back|seatbelt|hooks|take.?the.?back/
const CONTROL_RE = /control|grip|underhook|crossface|pressure|consolidate|hold|pin|posture.?up/

function classify(t) {
  const blob = txt(t.name) + ' ' + t.tags.join(' ')
  const target = nodesById[t.to]
  if (SUB_RE.test(blob) && !NOTSUB_RE.test(blob)) return 'submission'
  if (SWEEP_RE.test(blob)) return 'sweep'
  if (TAKEDOWN_RE.test(blob)) return 'takedown'
  if (PASS_RE.test(blob)) return 'pass'
  if (BACKTAKE_RE.test(blob) && target && target.tags.includes('back')) return 'backtake'
  if (ESCAPE_RE.test(blob)) return 'escape'
  if (CONTROL_RE.test(blob)) return 'control'
  return 'transition'
}
// Resolve a readable name for EVERY curated node (no "?"). Order: real description →
// dominant position tag → the move that creates this position (most untagged/unnamed
// GrappleMap nodes are mid-transition states, so the incoming technique names them) →
// a named neighbour → generic. Incoming moves come from the curated edges.
const incoming = {}
for (const t of subEdges) (incoming[t.to] ||= []).push(t)
function synthName(n) {
  const raw = (n.name || '').trim()
  if (!isJunk(raw)) return raw
  const mp = mainPos(n)
  if (mp !== 'the position') return mp
  const inMoves = (incoming[n.id] || []).map((t) => (t.name || '').trim()).filter((s) => !isJunk(s) && s !== 'transition')
  if (inMoves.length) return inMoves[0]
  const neighbour = (incoming[n.id] || [])
    .map((t) => (nodesById[t.from]?.name || '').trim())
    .find((s) => !isJunk(s))
  if (neighbour) return `transition from ${neighbour}`
  return 'transitional position'
}
const nameById = Object.fromEntries([...subNodeIds].map((id) => [id, synthName(nodesById[id])]))

const outNodes = [...subNodeIds].map((id) => {
  const n = nodesById[id]
  const dom = dominance(n)
  const conf = p0roles[id]?.conf ?? 0
  return {
    id: n.id,
    name: nameById[id],
    pos: posLabel(n),
    tags: n.tags,
    dominance: dom,
    neutral: !asymmetric(n),
    // Geometric "one grappler clearly dominates" — independent of the tag-based
    // `neutral`, which mislabels standing back-control as symmetric. Used to gate
    // advancing moves to the controller.
    controlled: dom > 0 || conf >= CONTROL_CONF,
  }
})
const outTrans = subEdges.map((t) => {
  const type = classify(t)
  // Authoritative player-swap per endpoint (GrappleMap reo.swap_players). Your
  // identity (which canonical player you are) flips across the edge iff the two
  // endpoints disagree. This is what the engine uses to keep "you" consistent and
  // to colour the live 3D render — replaces the earlier geometry/keyword guesses.
  const fromSwap = !!swaps[t.id]?.fromSwap
  const toSwap = !!swaps[t.id]?.toSwap
  return {
    id: t.id,
    from: t.from,
    to: t.to,
    name: transName(t, type, nameById[t.to]),
    type,
    fromSwap,
    toSwap,
    flipsRole: fromSwap !== toSwap,
  }
})
// Build full bidirectional adjacency: every node gets the transitions LEAVING it
// (forward) and the transitions ARRIVING at it (reverse = how to get back / escape).
// GrappleMap's own `outgoing` is forward-only, so we derive reverse ourselves.
const outMap = {}
for (const t of outTrans) {
  ;(outMap[t.from] ||= []).push({ t: t.id, rev: false })
  if (t.from !== t.to) (outMap[t.to] ||= []).push({ t: t.id, rev: true })
}
for (const n of outNodes) n.out = outMap[n.id] || []

// --- p0top: is GrappleMap player0 (rendered RED = you) the controller here? ---
// From the geometry decode (scripts/gm-roles.mjs). Every curated node has a
// decoded value; propagate via flipsRole only as a safety net for any gap.
for (const n of outNodes) n.p0top = p0roles[n.id]?.p0top
let changed = true
while (changed) {
  changed = false
  const byId = Object.fromEntries(outNodes.map((n) => [n.id, n]))
  for (const t of outTrans) {
    const a = byId[t.from], b = byId[t.to]
    if (a?.p0top !== undefined && b && b.p0top === undefined) { b.p0top = t.flipsRole ? !a.p0top : a.p0top; changed = true }
    else if (b?.p0top !== undefined && a && a.p0top === undefined) { a.p0top = t.flipsRole ? !b.p0top : b.p0top; changed = true }
  }
}
for (const n of outNodes) if (n.p0top === undefined) n.p0top = true
const decoded = outNodes.filter((n) => p0roles[n.id] !== undefined).length

// Start only from real standoffs: both standing neutral, or one standing / one
// seated (guard). Excludes mid-action standing states (snap down, clinch, etc).
const lc = (s) => (s || '').toLowerCase()
const isNeutralStand = (n) =>
  n.tags.includes('standing') &&
  /neutral|symmetric|staggered|squared.?up|stand.?off/.test(lc(n.name)) &&
  !/grip|tie|russian|under|over|drag/.test(lc(n.name))
const isSeatedStart = (n) =>
  n.tags.includes('standing') &&
  n.tags.includes('bottom_seated') &&
  /standing vs seated/.test(lc(n.name)) &&
  !/single|head inside|cocoon|limp/.test(lc(n.name)) &&
  n.out.length > 2
const startNodes = outNodes.filter((n) => (isNeutralStand(n) || isSeatedStart(n)) && n.out.length > 1).map((n) => n.id)

mkdirSync('src/data', { recursive: true })
const out = { startNodes, nodes: outNodes, transitions: outTrans }
writeFileSync('src/data/grapplemap.json', JSON.stringify(out))

// Canonical joint poses for the live 3D renderer: { id: [player0[23][x,y,z], player1[...]] }.
// (player0 = RED = you in canonical orientation; identity/colour is applied at render time.)
mkdirSync('public', { recursive: true })
const allJoints = JSON.parse(readFileSync('scripts/gm-joints.json', 'utf8'))
const poses = Object.fromEntries(outNodes.map((n) => [n.id, allJoints[n.id]]).filter(([, j]) => j))
writeFileSync('public/gm-poses.json', JSON.stringify(poses))

// Real per-transition keyframes for natural transition motion (the renderer plays
// these instead of lerping endpoints, so limbs don't pass through each other).
const frames = Object.fromEntries(outTrans.map((t) => [t.id, allFrames[t.id]]).filter(([, f]) => f && f.length))
writeFileSync('public/gm-frames.json', JSON.stringify(frames))

// ---- report ----
const byType = {}
for (const t of outTrans) byType[t.type] = (byType[t.type] || 0) + 1
console.log('nodes:', outNodes.length, 'transitions:', outTrans.length, 'startNodes:', startNodes.length)
console.log('p0top: decoded', decoded, 'propagated/defaulted', outNodes.length - decoded)
console.log('transition types:', byType)
console.log('avg outgoing per node:', (outNodes.reduce((s, n) => s + n.out.length, 0) / outNodes.length).toFixed(1))
const noOut = outNodes.filter((n) => n.out.length === 0).length
console.log('dead-end nodes (no outgoing in subgraph):', noOut)

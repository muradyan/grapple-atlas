// Capture per-node joint coordinates for both players from GrappleMap.
// GrappleMap's `Module.loadDB()` returns every node with `.position` =
// [player0[23]{x,y,z}, player1[23]{x,y,z}] (player0=RED, player1=BLUE; Y up;
// joint order = players.hpp: ...LeftHip=8,RightHip=9,LeftShoulder=10,
// RightShoulder=11,LeftWrist=14,RightWrist=15,LeftHand=16,RightHand=17,
// Core=20,Neck=21,Head=22). The interactive index page hides `position`, so we
// call Module.loadDB() ourselves. Verifies ids/names match scripts/gm-graph.json
// (so downstream node ids stay stable) before writing scripts/gm-joints.json.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'

const committed = JSON.parse(readFileSync('scripts/gm-graph.json', 'utf8'))
const committedName = Object.fromEntries(committed.nodes.map((n) => [n.id, (n.name || '').trim()]))

const b = await chromium.launch()
const p = await b.newPage()
await p.goto('https://eel.is/GrappleMap/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.waitForFunction(() => typeof window.Module?.loadDB === 'function', { timeout: 120000 })

const extracted = await p.evaluate(() => {
  const db = window.Module.loadDB()
  const r = (n) => Math.round(n * 1000) / 1000
  const nodes = db.nodes.map((n) => ({
    id: n.id,
    name: String((Array.isArray(n.description) ? n.description[0] : n.description) || '').split('\\n').join(' ').trim(),
    // [player][joint] -> [x,y,z]
    joints: n.position.map((pl) => pl.map((j) => [r(j.x), r(j.y), r(j.z)])),
  }))
  // Authoritative per-transition player-swap flags (reo.swap_players): whether
  // each endpoint connects to its node canonically or with the two players swapped.
  const swaps = db.transitions.map((t) => ({
    id: t.id,
    fromSwap: !!t.from.reo.swap_players,
    toSwap: !!t.to.reo.swap_players,
  }))
  // Per-transition animation keyframes: [frame][player][joint] -> [x,y,z].
  // The live 3D renderer interpolates these for smooth transition playback.
  const frames = db.transitions.map((t) => ({
    id: t.id,
    frames: t.frames.map((fr) => fr.map((pl) => pl.map((j) => [r(j.x), r(j.y), r(j.z)]))),
  }))
  return { nodes, swaps, frames }
})
await b.close()
const fresh = extracted.nodes

// ---- verify id/name stability against the committed graph ----
// Empty descriptions are stored inconsistently ("" vs "?"); treat as equal.
const norm = (s) => (!s || /^[?.…\s]+$/.test(s) ? '' : s)
let mismatches = 0
for (const n of fresh) {
  const want = committedName[n.id]
  if (want === undefined) continue // node not in curated raw graph; ignore
  if (norm(want) !== norm(n.name)) {
    mismatches++
    if (mismatches <= 10) console.log(`  id ${n.id}: live "${n.name}" != committed "${want}"`)
  }
}
const liveIds = new Set(fresh.map((n) => n.id))
const missing = committed.nodes.filter((n) => !liveIds.has(n.id)).length
console.log(`live nodes ${fresh.length}, committed ${committed.nodes.length}, name mismatches ${mismatches}, committed ids missing from live ${missing}`)
if (mismatches > 0 || missing > 0) {
  console.error('ABORT: node ids/names drifted from committed gm-graph.json — do not write (would corrupt media/id mapping).')
  process.exit(1)
}

const joints = Object.fromEntries(fresh.map((n) => [n.id, n.joints]))
writeFileSync('scripts/gm-joints.json', JSON.stringify(joints))
console.log(`wrote scripts/gm-joints.json for ${fresh.length} nodes (ids verified stable).`)

const swaps = Object.fromEntries(extracted.swaps.map((s) => [s.id, { fromSwap: s.fromSwap, toSwap: s.toSwap }]))
writeFileSync('scripts/gm-swaps.json', JSON.stringify(swaps))
const flip = extracted.swaps.filter((s) => s.fromSwap !== s.toSwap).length
console.log(`wrote scripts/gm-swaps.json for ${extracted.swaps.length} transitions (${flip} identity-flipping).`)

const frames = Object.fromEntries(extracted.frames.map((f) => [f.id, f.frames]))
writeFileSync('scripts/gm-frames.json', JSON.stringify(frames))
const totalFrames = extracted.frames.reduce((s, f) => s + f.frames.length, 0)
console.log(`wrote scripts/gm-frames.json for ${extracted.frames.length} transitions (${totalFrames} keyframes).`)

import type { MoveType } from './types'
import data from '../data/grapplemap.json'

// ---------------------------------------------------------------------------
// The GrappleMap graph: positions (nodes) and the transitions between them.
// Generated offline by scripts/gm-build.mjs from the PUBLIC-DOMAIN GrappleMap
// database and committed to the repo — the app needs no network / GrappleMap at
// runtime. Joint poses for the 3D render live in public/gm-poses.json.
// ---------------------------------------------------------------------------

export interface GNode {
  id: number
  name: string
  pos: string
  tags: string[]
  dominance: number
  neutral: boolean
  /** Is GrappleMap player0 (rendered RED) the controller here? (joint geometry) */
  p0top: boolean
  /** Does one grappler clearly dominate (vs a symmetric standing scramble)? */
  controlled: boolean
  out: { t: number; rev: boolean }[]
}

export interface GTransition {
  id: number
  from: number
  to: number
  name: string
  type: MoveType
  flipsRole: boolean
  /** GrappleMap reo.swap_players at each endpoint (player-swap vs the canonical node). */
  fromSwap: boolean
  toSwap: boolean
}

/** One navigable way out of a position (a transition in one direction). */
export interface Exit {
  /** Stable key: `${transId}f` (forward) or `${transId}r` (reverse). */
  key: string
  name: string
  type: MoveType
  /** Node you arrive at. */
  target: number
  targetName: string
  /** GrappleMap transition id (for the animation). */
  transId: number
  /** True when travelling the edge backwards. */
  reversed: boolean
  /** Does the red/blue identity flip across this edge (swap_players parity)? */
  flipsRole: boolean
  /** Per-endpoint player-swap (canonical-pose mapping for colouring). */
  fromSwap: boolean
  toSwap: boolean
}

const NODES: Record<number, GNode> = Object.fromEntries(
  (data.nodes as GNode[]).map((n) => [n.id, n]),
)
const TRANS: Record<number, GTransition> = Object.fromEntries(
  (data.transitions as GTransition[]).map((t) => [t.id, t]),
)
export const START_NODES: number[] = data.startNodes as number[]
export const ALL_NODES: GNode[] = data.nodes as GNode[]

export const nodeById = (id: number): GNode => NODES[id]

/**
 * Every way OUT of a position: forward transitions (real techniques, named by the
 * move) and reverse transitions (the way back, named by destination). This is the
 * full set of "sub-nodes" the explorer offers — no role gating, no scoring.
 */
export function exits(nodeId: number): Exit[] {
  const node = NODES[nodeId]
  if (!node) return []
  const out: Exit[] = []
  for (const o of node.out) {
    const tr = TRANS[o.t]
    if (!tr) continue
    const target = o.rev ? tr.from : tr.to
    const dest = NODES[target]
    if (!dest) continue
    out.push({
      key: `${o.t}${o.rev ? 'r' : 'f'}`,
      name: o.rev ? `back to ${dest.pos}` : tr.name || tr.type,
      type: tr.type,
      target,
      targetName: dest.name,
      transId: o.t,
      reversed: o.rev,
      flipsRole: tr.flipsRole,
      fromSwap: tr.fromSwap,
      toSwap: tr.toSwap,
    })
  }
  // De-dupe by display name, preferring forward edges.
  const seen = new Set<string>()
  return out
    .sort((a, b) => Number(a.reversed) - Number(b.reversed))
    .filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true)))
}

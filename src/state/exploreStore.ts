import { create } from 'zustand'
import { START_NODES, nodeById, type Exit } from '../engine/graph'
import { track } from '../analytics'
import { parsePositionId } from '../url'

const bit = (b: boolean) => (b ? 1 : 0)

// A step in the drilled path (breadcrumb).
interface Step {
  node: number
  /** Which canonical player (0/1) is RED here (stable identity along the path). */
  redIdx: number
}

interface ExploreStore {
  /** False until the user picks a starting position (shows the start screen). */
  started: boolean
  /** Currently shown position. */
  current: number
  /** Which canonical player (0/1) is red at `current` (stable identity). */
  redIdx: number
  /** The drilled path from start to current (breadcrumb). Last entry = current. */
  path: Step[]
  /** Positions ever visited (for subtle "seen" marks). */
  visited: number[]
  /** The exit just taken (drives the 3D keyframe animation). null = jump up. */
  lastExit: Exit | null
  /** Which CLIP figure is red during the current animation. */
  animClipRedIdx: number

  start: (nodeId?: number) => void
  /** Drill into a transition of the CURRENT position (always a direct move). */
  goTo: (exit: Exit) => void
  /** Jump back up to a breadcrumb step. */
  jumpTo: (index: number) => void
  newStart: () => void
}

const DEFAULT_START = START_NODES[0] ?? 0
// Deep link: if the URL hash names a valid position, start there (skip the chooser).
const urlId = typeof location !== 'undefined' ? parsePositionId(location.hash) : null
const SEEDED = urlId != null && nodeById(urlId) ? urlId : null
const INIT = SEEDED ?? DEFAULT_START

export const useExplore = create<ExploreStore>((set, get) => ({
  started: SEEDED != null,
  current: INIT,
  redIdx: 0,
  path: [{ node: INIT, redIdx: 0 }],
  visited: [INIT],
  lastExit: null,
  animClipRedIdx: 0,

  start: (nodeId = DEFAULT_START) => {
    track('position_picked', { name: nodeById(nodeId)?.name })
    set({ started: true, current: nodeId, redIdx: 0, path: [{ node: nodeId, redIdx: 0 }], visited: [nodeId], lastExit: null, animClipRedIdx: 0 })
  },

  goTo: (exit) => {
    const { redIdx, path, visited } = get()
    track('transition_explored', { name: exit.name, type: exit.type, target: exit.targetName, reversed: exit.reversed })
    const swapAtCurrent = exit.reversed ? bit(exit.toSwap) : bit(exit.fromSwap)
    const clipRedIdx = redIdx ^ swapAtCurrent // red figure (stable identity) during the clip
    const nextRed = redIdx ^ bit(exit.flipsRole) // identity flips only across swap_players edges
    set({
      current: exit.target,
      redIdx: nextRed,
      path: [...path, { node: exit.target, redIdx: nextRed }],
      visited: visited.includes(exit.target) ? visited : [...visited, exit.target],
      lastExit: exit,
      animClipRedIdx: clipRedIdx,
    })
  },

  jumpTo: (index) => {
    const { path } = get()
    if (index < 0 || index >= path.length) return
    const trimmed = path.slice(0, index + 1)
    const cur = trimmed[trimmed.length - 1]
    set({ current: cur.node, redIdx: cur.redIdx, path: trimmed, lastExit: null })
  },

  newStart: () => set({ started: false }),
}))

// expose for console debugging in dev
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__explore = useExplore
}

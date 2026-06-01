// ---------------------------------------------------------------------------
// Core domain types for Grapple Atlas. The app navigates GrappleMap's
// directed graph of positions (nodes) and transitions (edges); see graph.ts.
// ---------------------------------------------------------------------------

/** The kind of a transition (used for labels/colour chips). */
export type MoveType =
  | 'submission'
  | 'sweep'
  | 'takedown'
  | 'pass'
  | 'backtake'
  | 'escape'
  | 'control'
  | 'transition'

import type { GNode } from './engine/graph'

// Shareable per-position deep links. Hash-based (`#<slug>-<id>`) so they work on any
// static host with no server rewrite, and the position id is the trailing number.

const kebab = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'position'

/** Build the URL hash for a position, e.g. "#mount-150". */
export const positionHash = (node: GNode): string => `#${kebab(node.name)}-${node.id}`

/** Parse a position id out of a URL hash (trailing digits), or null. */
export function parsePositionId(hash: string): number | null {
  const m = (hash || '').match(/(\d+)\s*$/)
  return m ? Number(m[1]) : null
}

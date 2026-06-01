import { describe, expect, it } from 'vitest'
import data from '../../data/grapplemap.json'
import { exits, nodeById, START_NODES, ALL_NODES } from '../graph'

describe('graph data', () => {
  it('loads nodes, transitions and start nodes', () => {
    expect(ALL_NODES.length).toBeGreaterThan(100)
    expect(data.transitions.length).toBeGreaterThan(100)
    expect(START_NODES.length).toBeGreaterThan(0)
    expect(nodeById(START_NODES[0])).toBeTruthy()
  })

  it('every node carries geometry/identity fields', () => {
    expect(ALL_NODES.every((n) => typeof n.p0top === 'boolean' && typeof n.controlled === 'boolean')).toBe(true)
  })

  it('flipsRole equals the swap_players parity', () => {
    const ts = data.transitions as { fromSwap: boolean; toSwap: boolean; flipsRole: boolean }[]
    expect(ts.every((t) => t.flipsRole === (t.fromSwap !== t.toSwap))).toBe(true)
  })
})

describe('exits', () => {
  it('returns valid, navigable edges (forward + reverse) for every node', () => {
    for (const n of ALL_NODES) {
      for (const e of exits(n.id)) {
        expect(nodeById(e.target)).toBeTruthy()
        expect(e.targetName).toBe(nodeById(e.target).name)
        expect(e.key.endsWith(e.reversed ? 'r' : 'f')).toBe(true)
        expect(typeof e.flipsRole).toBe('boolean')
      }
    }
  })

  it('most positions offer at least one exit', () => {
    const withExits = ALL_NODES.filter((n) => exits(n.id).length > 0).length
    expect(withExits / ALL_NODES.length).toBeGreaterThan(0.9)
  })

  it('de-dupes by display name', () => {
    const n = START_NODES[0]
    const names = exits(n).map((e) => e.name)
    expect(names.length).toBe(new Set(names).size)
  })
})

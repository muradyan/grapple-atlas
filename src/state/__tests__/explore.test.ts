import { beforeEach, describe, expect, it } from 'vitest'
import { useExplore } from '../exploreStore'
import { exits, START_NODES } from '../../engine/graph'

const START = START_NODES[0]
beforeEach(() => useExplore.getState().start(START))

describe('exploreStore (drill-in)', () => {
  it('start() roots the path, red=0, marks visited', () => {
    const s = useExplore.getState()
    expect(s.started).toBe(true)
    expect(s.current).toBe(START)
    expect(s.redIdx).toBe(0)
    expect(s.path).toEqual([{ node: START, redIdx: 0 }])
    expect(s.visited).toEqual([START])
  })

  it('goTo() drills in: pushes the path, flips identity only across swap edges, arms the animation', () => {
    const e = exits(START)[0]
    useExplore.getState().goTo(e)
    const s = useExplore.getState()
    expect(s.current).toBe(e.target)
    expect(s.path.length).toBe(2)
    expect(s.redIdx).toBe(0 ^ (e.flipsRole ? 1 : 0))
    expect(s.visited).toContain(e.target)
    expect(s.lastExit).toEqual(e)
  })

  it('jumpTo() goes back up the breadcrumb', () => {
    const e = exits(START)[0]
    useExplore.getState().goTo(e)
    useExplore.getState().jumpTo(0)
    const s = useExplore.getState()
    expect(s.current).toBe(START)
    expect(s.redIdx).toBe(0)
    expect(s.path.length).toBe(1)
    expect(s.lastExit).toBeNull()
  })

  it('newStart() returns to the chooser', () => {
    useExplore.getState().newStart()
    expect(useExplore.getState().started).toBe(false)
  })
})

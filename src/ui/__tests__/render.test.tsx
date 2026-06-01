import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from '../../App'
import { useExplore } from '../../state/exploreStore'
import { nodeById, START_NODES } from '../../engine/graph'

afterEach(cleanup)

describe('Grapple Atlas', () => {
  it('shows the start chooser before a position is picked', () => {
    useExplore.getState().newStart()
    render(<App />)
    expect(screen.getByText('Common starting positions')).toBeInTheDocument()
  })

  it('enters the drill-in explorer once a start is chosen', () => {
    useExplore.getState().start(START_NODES[0])
    render(<App />)
    expect(screen.getByText('Transitions from here')).toBeInTheDocument()
    // breadcrumb shows the start position
    expect(screen.getAllByText(new RegExp(nodeById(START_NODES[0]).name, 'i')).length).toBeGreaterThan(0)
  })
})

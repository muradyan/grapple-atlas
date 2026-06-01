import { useEffect, useMemo, useState } from 'react'
import { useExplore } from '../state/exploreStore'
import { ALL_NODES, nodeById } from '../engine/graph'
import { positionHash, parsePositionId } from '../url'
import PositionView from './PositionView'
import StartScreen from './StartScreen'
import DrillView from './DrillView'
import Feedback from './Feedback'

export default function ExploreScreen() {
  const { started, current, redIdx, lastExit, animClipRedIdx, start, newStart } = useExplore()
  const [picking, setPicking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Keep the URL in sync with the current position (shareable deep link), and
  // react to back/forward or a pasted hash while the app is open.
  useEffect(() => {
    if (started) {
      const want = positionHash(nodeById(current))
      if (location.hash !== want) history.replaceState(null, '', want)
    }
  }, [started, current])

  useEffect(() => {
    const onHash = () => {
      const id = parsePositionId(location.hash)
      if (id != null && nodeById(id) && id !== useExplore.getState().current) start(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [start])

  const share = async () => {
    try {
      const url = location.href
      if (navigator.share) await navigator.share({ title: 'Grapple Atlas', url })
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    } catch { /* user dismissed */ }
  }

  // Animate (play the transition's real keyframes) after a move; red = stable identity.
  const anim = useMemo(() => {
    if (!lastExit) return null
    return { transId: lastExit.transId, reversed: lastExit.reversed, redClipIdx: animClipRedIdx }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, lastExit])

  if (!started) return <StartScreen />

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4">
      {/* header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-base font-bold uppercase tracking-widest text-white sm:text-lg">
          Grapple <span className="text-accent">Atlas</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={newStart}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-mat-700/80 sm:text-xs"
          >
            ↺ New start
          </button>
          <button
            onClick={share}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-mat-700/80 sm:text-xs"
          >
            {copied ? 'Copied!' : '↗ Share'}
          </button>
          <button
            onClick={() => setPicking((v) => !v)}
            className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-display font-semibold uppercase tracking-wider text-mat-900 hover:bg-accent-glow sm:text-xs"
          >
            Jump to position
          </button>
        </div>
      </div>

      {picking && <StartPicker onPick={(id) => { start(id); setPicking(false) }} />}

      {/* [position] [tree] */}
      <div className="mt-1 lg:grid lg:gap-3 lg:grid-cols-[1fr_440px] lg:items-start xl:grid-cols-[1fr_520px]">
        {/* Mat: pinned to the top on mobile so the animation stays visible while you
            scroll the tree; normal grid cell on desktop. */}
        <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-white/10 bg-mat-900/95 px-4 pb-2 pt-1 backdrop-blur lg:static lg:mx-0 lg:mb-0 lg:border-0 lg:bg-transparent lg:p-0">
          <PositionView node={current} redIdx={redIdx} anim={anim} />
        </div>
        <div className="lg:max-h-[82vh] lg:overflow-auto">
          <DrillView />
        </div>
      </div>

      <Feedback className="mt-6" />
    </div>
  )
}

function StartPicker({ onPick }: { onPick: (id: number) => void }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return ALL_NODES.filter((n) => n.name.toLowerCase().includes(query)).slice(0, 40)
  }, [q])

  return (
    <div className="mb-3 card-surface p-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search positions to jump to (e.g. mount, closed guard, back)…"
        className="w-full rounded-lg border border-white/10 bg-mat-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent focus:outline-none"
      />
      {results.length > 0 && (
        <div className="mt-2 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
          {results.map((n) => (
            <button key={n.id} onClick={() => onPick(n.id)} className="truncate rounded px-2 py-1 text-left text-xs capitalize text-slate-300 hover:bg-mat-700/80 hover:text-white" title={n.name}>
              {n.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useExplore } from '../state/exploreStore'
import { ALL_NODES, START_NODES, nodeById } from '../engine/graph'
import Feedback from './Feedback'

// Landing screen: the user explicitly picks where to begin exploring (instead of
// the app dropping them into a default position).
export default function StartScreen() {
  const start = useExplore((s) => s.start)
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return ALL_NODES.filter((n) => n.name.toLowerCase().includes(query)).slice(0, 60)
  }, [q])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-bold uppercase tracking-widest text-white">
          Grapple <span className="text-accent">Atlas</span>
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
          Pick a position to start, then explore every transition out of it — travel the
          graph, branch off, and see how grappling connects.
        </p>
      </div>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any position (e.g. mount, closed guard, back, half guard)…"
        className="mb-6 w-full rounded-xl border border-white/10 bg-mat-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-accent focus:outline-none"
      />

      {q ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {results.map((n) => (
            <StartCard key={n.id} id={n.id} onPick={start} />
          ))}
          {results.length === 0 && <p className="col-span-full text-sm text-slate-500">No positions match “{q}”.</p>}
        </div>
      ) : (
        <>
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-slate-400">
            Common starting positions
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {START_NODES.map((id) => (
              <StartCard key={id} id={id} onPick={start} />
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">…or search above to start from any of {ALL_NODES.length} positions.</p>
        </>
      )}

      <Feedback className="mt-10" />
    </div>
  )
}

function StartCard({ id, onPick }: { id: number; onPick: (id: number) => void }) {
  const n = nodeById(id)
  return (
    <button
      onClick={() => onPick(id)}
      className="card-surface flex flex-col p-3 text-left transition hover:bg-mat-700/80 hover:border-accent/40"
    >
      <span className="font-display text-base font-semibold capitalize leading-tight text-white">{n.name}</span>
      <span className="mt-1 truncate text-[11px] uppercase tracking-wider text-slate-500">
        {n.tags.slice(0, 4).join(' · ').replace(/_/g, ' ')}
      </span>
    </button>
  )
}

import { useExplore } from '../state/exploreStore'
import { exits, nodeById, type Exit } from '../engine/graph'
import { MOVE_TYPE_STYLE } from './moveStyle'

// Drill-in navigation (mobile-friendly): a breadcrumb of the path you've walked +
// the CURRENT position's transitions as a flat, full-width list. Tap a transition to
// drill into it; tap a breadcrumb step to go back up. No deep nesting to get lost in.
// (We intentionally don't label which athlete performs each move — GrappleMap doesn't
//  record a performer for ~1/5 of transitions, so it can't be shown reliably.)

export default function DrillView() {
  const path = useExplore((s) => s.path)
  const current = useExplore((s) => s.current)
  const visited = useExplore((s) => s.visited)
  const goTo = useExplore((s) => s.goTo)
  const jumpTo = useExplore((s) => s.jumpTo)

  const all = exits(current)
  const forward = all.filter((e) => !e.reversed)
  const back = all.filter((e) => e.reversed)

  return (
    <div className="flex flex-col gap-3">
      {/* breadcrumb */}
      <nav className="card-surface flex items-center gap-1 overflow-x-auto whitespace-nowrap p-2 text-xs">
        {path.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-600">›</span>}
            <button
              onClick={() => jumpTo(i)}
              className={`max-w-[12rem] truncate rounded px-1.5 py-0.5 capitalize ${
                i === path.length - 1 ? 'bg-accent/20 font-semibold text-accent' : 'text-slate-400 hover:bg-mat-700/80 hover:text-white'
              }`}
              title={nodeById(s.node).name}
            >
              {nodeById(s.node).name}
            </button>
          </span>
        ))}
      </nav>

      <ExitList title="Transitions from here" hint="techniques that leave this position" exits={forward} visited={visited} onGo={goTo} />
      {back.length > 0 && (
        <ExitList title="Ways back" hint="reverse toward a previous position" exits={back} visited={visited} onGo={goTo} />
      )}
      {all.length === 0 && (
        <p className="card-surface p-4 text-sm text-slate-400">No transitions recorded from this position. Use a breadcrumb step or “Jump to position”.</p>
      )}
    </div>
  )
}

function ExitList({
  title, hint, exits, visited, onGo,
}: {
  title: string
  hint: string
  exits: Exit[]
  visited: number[]
  onGo: (e: Exit) => void
}) {
  if (exits.length === 0) return null
  return (
    <div>
      <div className="mb-2 px-1">
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-slate-300">{title}</h3>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
      <div className="flex flex-col gap-2">
        {exits.map((e) => {
          const style = MOVE_TYPE_STYLE[e.type]
          const seen = visited.includes(e.target)
          return (
            <button
              key={e.key}
              onClick={() => onGo(e)}
              className={`group card-surface flex items-center gap-2 p-3 text-left transition ${style.ring} hover:bg-mat-700/80`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-base font-semibold capitalize leading-tight text-white">{e.targetName}</span>
                  <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}>
                    {style.label}
                  </span>
                </div>
                <span className="truncate text-[11px] capitalize text-slate-500">
                  via {e.name}
                  {seen && <span className="ml-1 normal-case text-slate-600">· seen</span>}
                </span>
              </div>
              <span className="shrink-0 text-slate-500 group-hover:text-white">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

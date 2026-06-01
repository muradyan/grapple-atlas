import type { MoveType } from '../engine/types'

export interface MoveTypeStyle {
  label: string
  chip: string
  ring: string
}

export const MOVE_TYPE_STYLE: Record<MoveType, MoveTypeStyle> = {
  submission: { label: 'Submission', chip: 'text-rose-300 border-rose-400/40 bg-rose-500/10', ring: 'hover:border-rose-400/60' },
  sweep: { label: 'Sweep', chip: 'text-amber-300 border-amber-400/40 bg-amber-500/10', ring: 'hover:border-amber-400/60' },
  takedown: { label: 'Takedown', chip: 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10', ring: 'hover:border-cyan-400/60' },
  pass: { label: 'Pass', chip: 'text-sky-300 border-sky-400/40 bg-sky-500/10', ring: 'hover:border-sky-400/60' },
  backtake: { label: 'Back take', chip: 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10', ring: 'hover:border-fuchsia-400/60' },
  escape: { label: 'Escape', chip: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10', ring: 'hover:border-emerald-400/60' },
  control: { label: 'Control', chip: 'text-slate-300 border-slate-400/40 bg-slate-500/10', ring: 'hover:border-slate-400/60' },
  transition: { label: 'Transition', chip: 'text-violet-300 border-violet-400/40 bg-violet-500/10', ring: 'hover:border-violet-400/60' },
}

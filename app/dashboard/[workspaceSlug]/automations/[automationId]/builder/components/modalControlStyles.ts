import { cn } from '@/lib/utils'

export function modalPillClass({
  selected,
  disabled = false,
}: {
  selected: boolean
  disabled?: boolean
}) {
  return cn(
    'rounded-full border px-3 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
    disabled
      ? 'cursor-not-allowed border-slate-800 bg-slate-950/35 text-slate-500 opacity-55'
      : 'cursor-pointer',
    selected
      ? 'border-cyan-300/65 bg-cyan-300/10 text-cyan-50 shadow-sm shadow-cyan-950/25'
      : !disabled &&
          'border-slate-600/85 bg-slate-900/65 text-slate-200 hover:border-slate-400/90 hover:bg-slate-800/80 hover:text-slate-50',
  )
}

export function modalStarterChoiceClass({
  selected,
  disabled = false,
}: {
  selected: boolean
  disabled?: boolean
}) {
  return cn(
    'rounded-xl border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
    disabled
      ? 'cursor-not-allowed border-slate-800 bg-slate-950/35 text-slate-500 opacity-55'
      : 'cursor-pointer',
    selected
      ? 'border-cyan-300/65 bg-cyan-300/10 text-cyan-50 shadow-lg shadow-cyan-950/25'
      : !disabled &&
          'border-slate-600/85 bg-slate-900/55 text-slate-200 hover:border-slate-400/90 hover:bg-slate-800/80 hover:text-slate-50',
  )
}

export function modalOptionCardClass({
  selected,
  disabled = false,
  className,
}: {
  selected: boolean
  disabled?: boolean
  className?: string
}) {
  return cn(
    'rounded-xl border text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
    disabled
      ? 'cursor-not-allowed border-slate-800 bg-slate-950/35 text-slate-500 opacity-55'
      : 'cursor-pointer',
    selected
      ? 'border-cyan-300/55 bg-cyan-300/10 text-cyan-50 shadow-lg shadow-cyan-950/20'
      : !disabled &&
          'border-slate-700/80 bg-slate-900/55 text-slate-300 hover:border-slate-500/90 hover:bg-slate-800/70 hover:text-slate-50',
    className,
  )
}

export const modalCardTitleClass = 'font-semibold text-slate-100'
export const modalCardDescriptionClass = 'mt-1 block text-[11px] text-slate-500'

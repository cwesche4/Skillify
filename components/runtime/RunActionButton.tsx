import type { FC } from 'react'
import { Loader2 } from 'lucide-react'

type Props = {
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  confirming?: boolean
}

export const RunActionButton: FC<Props> = ({
  label,
  onClick,
  disabled = false,
  destructive = false,
  confirming = false,
}) => {
  const base =
    'inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors'
  const intent = destructive
    ? 'border border-rose-600/70 bg-rose-600/10 text-rose-100 hover:border-rose-500'
    : 'border border-slate-600/70 bg-slate-900 text-slate-100 hover:border-slate-500'
  const state = disabled
    ? 'opacity-60 cursor-not-allowed hover:border-slate-600'
    : 'cursor-pointer'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${intent} ${state}`}
    >
      {confirming ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : null}
      {label}
    </button>
  )
}

export default RunActionButton

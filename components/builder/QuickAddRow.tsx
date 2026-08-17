import type { FC } from 'react'
import type { BuilderNodeType } from '@/lib/builder/node-types'

type Props = {
  type: BuilderNodeType
  label: string
  category?: string
  highlighted?: boolean
  disabled?: boolean
  onClick: () => void
}

export const QuickAddRow: FC<Props> = ({
  type,
  label,
  category,
  highlighted = false,
  disabled = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left text-[12px] ${
        disabled
          ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500'
          : highlighted
            ? 'border-emerald-600/70 bg-emerald-600/10 text-slate-100'
            : 'border-slate-800 bg-slate-900 text-slate-100 hover:border-slate-600'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] text-slate-500">{category ?? type}</span>
    </button>
  )
}

export default QuickAddRow

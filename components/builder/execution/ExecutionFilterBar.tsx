'use client'

import type { FC } from 'react'
import type { ExecutionFilterMode } from '@/lib/runs/timeline/filterExecutionState'

type Props = {
  mode: ExecutionFilterMode
  onChange: (mode: ExecutionFilterMode) => void
}

// Execution filters.
// Read-only visualization.
// Never infer or mutate execution.
export const ExecutionFilterBar: FC<Props> = ({ mode, onChange }) => {
  const btn = (label: string, value: ExecutionFilterMode) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded border px-2 py-1 text-[12px] ${
        mode === value
          ? 'border-emerald-600/70 bg-emerald-600/10 text-emerald-100'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="inline-flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <span className="text-[11px] text-slate-400">
        Execution filters (visual-only)
      </span>
      {btn('All', 'none')}
      {btn('Failed only', 'failed')}
      {btn('Approval waits', 'approval')}
      {btn('Active path', 'active')}
    </div>
  )
}

export default ExecutionFilterBar

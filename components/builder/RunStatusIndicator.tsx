import type { FC } from 'react'

type RunStatus = 'success' | 'failed' | 'partial' | 'unknown'

type Props = {
  status: RunStatus
}

const labelFor: Record<RunStatus, string> = {
  success: 'Run status: Success',
  failed: 'Run status: Failed',
  partial: 'Run status: Partial',
  unknown: 'Run status: Unknown',
}

const classFor = (status: RunStatus) => {
  switch (status) {
    case 'success':
      return 'border-emerald-600/70 bg-emerald-600/10 text-emerald-100'
    case 'failed':
      return 'border-rose-600/70 bg-rose-600/10 text-rose-100'
    case 'partial':
      return 'border-amber-600/70 bg-amber-600/10 text-amber-100'
    default:
      return 'border-slate-600/70 bg-slate-900/80 text-slate-200'
  }
}

export const RunStatusIndicator: FC<Props> = ({ status }) => {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[12px] font-semibold ${classFor(
        status,
      )}`}
    >
      {labelFor[status]}
    </div>
  )
}

export default RunStatusIndicator

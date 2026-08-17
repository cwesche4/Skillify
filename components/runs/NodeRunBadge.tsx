import type { FC } from 'react'
import { CheckCircle, AlertTriangle, Slash } from 'lucide-react'
import type { TimelineItem } from '@/lib/runs/timeline/types'

type Props = {
  status: TimelineItem['status']
  label?: string
}

export const NodeRunBadge: FC<Props> = ({ status, label }) => {
  const icon =
    status === 'success' ? (
      <CheckCircle className="h-3 w-3 text-emerald-400" aria-hidden />
    ) : status === 'skipped' ? (
      <Slash className="h-3 w-3 text-slate-400" aria-hidden />
    ) : (
      <AlertTriangle className="h-3 w-3 text-rose-400" aria-hidden />
    )
  const text =
    status === 'success'
      ? (label ?? 'Success')
      : status === 'skipped'
        ? (label ?? 'Skipped')
        : (label ?? 'Failed')

  const bg =
    status === 'success'
      ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-100'
      : status === 'skipped'
        ? 'bg-slate-950/50 border-slate-800 text-slate-200'
        : 'bg-rose-950/50 border-rose-800/60 text-rose-100'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${bg}`}
      aria-label={`Node status ${status}`}
    >
      {icon}
      {text}
    </span>
  )
}

export default NodeRunBadge

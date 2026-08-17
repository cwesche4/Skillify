import type { FC } from 'react'
import { AlertTriangle, CheckCircle, MinusCircle } from 'lucide-react'
import type { RunStatus } from '@/lib/runs/status/computeRunStatus'

type Props = {
  status: RunStatus
}

export const RunStatusBanner: FC<Props> = ({ status }) => {
  const icon =
    status === 'success' ? (
      <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden />
    ) : status === 'partial-failure' ? (
      <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
    ) : (
      <MinusCircle className="h-4 w-4 text-rose-400" aria-hidden />
    )

  const text =
    status === 'success'
      ? 'Run succeeded'
      : status === 'partial-failure'
        ? 'Run partially failed (some nodes failed or were skipped)'
        : 'Run failed'

  const bgClass =
    status === 'success'
      ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-100'
      : status === 'partial-failure'
        ? 'bg-amber-950/40 border-amber-700/60 text-amber-100'
        : 'bg-rose-950/40 border-rose-700/60 text-rose-100'

  return (
    <div
      className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${bgClass}`}
      aria-label="Run status"
    >
      {icon}
      <span className="font-semibold">{text}</span>
    </div>
  )
}

export default RunStatusBanner

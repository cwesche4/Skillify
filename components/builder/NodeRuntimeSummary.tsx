import type { FC } from 'react'
import { CheckCircle, AlertTriangle, Slash } from 'lucide-react'

type Props = {
  lastOutcome?: 'success' | 'failed' | 'skipped'
  lastMessage?: string
  logSummary?: string
}

export const NodeRuntimeSummary: FC<Props> = ({
  lastOutcome,
  lastMessage,
  logSummary,
}) => {
  const icon =
    lastOutcome === 'success' ? (
      <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden />
    ) : lastOutcome === 'skipped' ? (
      <Slash className="h-4 w-4 text-slate-400" aria-hidden />
    ) : (
      <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden />
    )

  const label =
    lastOutcome === 'success'
      ? 'Last run: success'
      : lastOutcome === 'skipped'
        ? 'Last run: skipped'
        : lastOutcome === 'failed'
          ? 'Last run: failed'
          : 'No run data'

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      {lastMessage ? (
        <div className="text-[11px] text-slate-300">{lastMessage}</div>
      ) : null}
      {logSummary ? (
        <div className="mt-1 rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
          {logSummary}
        </div>
      ) : null}
    </div>
  )
}

export default NodeRuntimeSummary

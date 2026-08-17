import type { FC } from 'react'
import { CheckCircle, AlertTriangle, Slash } from 'lucide-react'
import type { NodeOutcome } from '@/lib/runs/lastOutcome'
import FailureExplanation from './FailureExplanation'

type Props = {
  outcome?: NodeOutcome
  onJump?: (nodeId: string, eventId: string) => void
}

const iconFor = (status: NodeOutcome['status']) => {
  switch (status) {
    case 'success':
      return (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
      )
    case 'failed':
      return <AlertTriangle className="h-3.5 w-3.5 text-rose-400" aria-hidden />
    case 'skipped':
    default:
      return <Slash className="h-3.5 w-3.5 text-slate-400" aria-hidden />
  }
}

const labelFor = (status: NodeOutcome['status']) => {
  switch (status) {
    case 'success':
      return 'Success'
    case 'failed':
      return 'Failed'
    case 'skipped':
    default:
      return 'Skipped'
  }
}

export const NodeOutcomeBadge: FC<Props> = ({ outcome, onJump }) => {
  if (!outcome) return null
  const date = new Date(outcome.timestamp)
  const relative = date.toLocaleString()
  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onJump?.(outcome.nodeId, outcome.eventId)}
        title={outcome.message}
        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      >
        {iconFor(outcome.status)}
        <span>{labelFor(outcome.status)}</span>
        <span className="text-[10px] text-slate-400">{relative}</span>
      </button>
      {outcome.status === 'failed' ? (
        <FailureExplanation message={outcome.message} />
      ) : null}
    </div>
  )
}

export default NodeOutcomeBadge

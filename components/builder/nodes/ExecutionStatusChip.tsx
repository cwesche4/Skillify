import type { FC } from 'react'
import { Clock, ShieldAlert } from 'lucide-react'

type ChipType = 'approval-wait' | 'sla-breach'

type Props = {
  type: ChipType
  message?: string
}

const labelFor: Record<ChipType, string> = {
  'approval-wait': 'Awaiting approval',
  'sla-breach': 'SLA breached',
}

export const ExecutionStatusChip: FC<Props> = ({ type, message }) => {
  const Icon = type === 'approval-wait' ? Clock : ShieldAlert
  const color =
    type === 'approval-wait'
      ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
      : 'border-rose-500/60 bg-rose-500/10 text-rose-100'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${color}`}
      title={message}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {labelFor[type]}
    </span>
  )
}

export default ExecutionStatusChip

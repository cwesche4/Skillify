import type { FC } from 'react'
import { Power } from 'lucide-react'

type Props = {
  onReenable: (reason: string) => void
}

export const ReenableExecutions: FC<Props> = ({ onReenable }) => {
  const handleClick = () => {
    const reason = prompt(
      'Enter reason for re-enabling executions (will be logged):',
      '',
    )
    if (reason !== null) onReenable(reason)
  }

  return (
    <div className="rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
      <div className="font-semibold">Re-enable Executions</div>
      <div className="text-[11px] text-emerald-200">
        Admin-only. Generates audit events. Ensure incidents/legal holds are
        resolved before re-enabling.
      </div>
      <button
        onClick={handleClick}
        className="mt-2 inline-flex items-center gap-1 rounded border border-emerald-700 bg-emerald-900 px-2 py-1 text-[12px] text-emerald-100"
      >
        <Power className="h-3 w-3" aria-hidden />
        Re-enable
      </button>
    </div>
  )
}

export default ReenableExecutions

import type { FC } from 'react'
import { AlertTriangle, Power } from 'lucide-react'

type Props = {
  onKill: (reason: string) => void
}

export const KillSwitch: FC<Props> = ({ onKill }) => {
  const handleClick = () => {
    const reason = prompt(
      'Enter reason for kill switch activation (will be logged):',
      '',
    )
    if (reason !== null) onKill(reason)
  }

  return (
    <div className="rounded border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <div className="font-semibold">Emergency Kill Switch (Workspace)</div>
      </div>
      <div className="mt-1 text-[11px] text-rose-200">
        Admin-only. Stops active runs in this workspace; future runs blocked
        until re-enabled. Kill is logged as events.
      </div>
      <button
        onClick={handleClick}
        className="mt-2 inline-flex items-center gap-1 rounded border border-rose-700 bg-rose-900 px-2 py-1 text-[12px] text-rose-100"
      >
        <Power className="h-3 w-3" aria-hidden />
        Activate Kill Switch
      </button>
    </div>
  )
}

export default KillSwitch

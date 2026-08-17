import type { FC } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'

type Props = {
  active: boolean
  message?: string
}

export const KillStatusBanner: FC<Props> = ({ active, message }) => {
  return (
    <div
      className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
        active
          ? 'border-rose-700/60 bg-rose-950/40 text-rose-100'
          : 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100'
      }`}
      aria-label="Kill switch status"
    >
      {active ? (
        <ShieldAlert className="h-4 w-4" aria-hidden />
      ) : (
        <ShieldCheck className="h-4 w-4" aria-hidden />
      )}
      <span className="font-semibold">
        {active
          ? 'Kill switch active — executions blocked'
          : 'Kill switch inactive'}
      </span>
      {message ? (
        <span className="text-[11px] text-slate-200">{message}</span>
      ) : null}
    </div>
  )
}

export default KillStatusBanner

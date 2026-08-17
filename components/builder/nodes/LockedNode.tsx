import type { FC } from 'react'
import { Lock } from 'lucide-react'

type Props = {
  label: string
  description?: string
}

export const LockedNode: FC<Props> = ({ label, description }) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
      <div className="mb-1 flex items-center gap-2 text-amber-200">
        <Lock className="h-4 w-4" aria-hidden />
        <span className="font-semibold">{label}</span>
      </div>
      <p className="text-[12px] text-slate-400">
        {description ?? 'This capability requires premium entitlements.'}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Preview is read-only; execution remains unchanged for existing
        automations.
      </p>
    </div>
  )
}

export default LockedNode

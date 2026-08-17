import type { FC } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import type { UsageWarning } from '@/lib/usage/types'

type Props = {
  warnings: UsageWarning[]
}

export const UsageBadge: FC<Props> = ({ warnings }) => {
  if (!warnings.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-200">
        <Info className="h-3.5 w-3.5" aria-hidden />
        Usage within soft limits
      </span>
    )
  }

  const latest = warnings[warnings.length - 1]

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/60 bg-amber-600/10 px-2 py-1 text-[12px] text-amber-100">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      {latest.message}
    </span>
  )
}

export default UsageBadge

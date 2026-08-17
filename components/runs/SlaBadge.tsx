import type { FC } from 'react'
import { Timer } from 'lucide-react'
import type { SlaBreachEvent } from '@/lib/runs/sla/types'

type Props = {
  breaches: SlaBreachEvent[]
}

export const SlaBadge: FC<Props> = ({ breaches }) => {
  if (!breaches.length) return null
  return (
    <div className="inline-flex items-center gap-1 rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-100">
      <Timer className="h-3 w-3" aria-hidden />
      <span>
        {breaches.length} SLA breach{breaches.length > 1 ? 'es' : ''}{' '}
        (informational)
      </span>
    </div>
  )
}

export default SlaBadge

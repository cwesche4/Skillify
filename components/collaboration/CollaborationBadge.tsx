import type { FC } from 'react'
import { Users, Eye, Wrench } from 'lucide-react'
import type { CollaborationAggregate } from '@/lib/collaboration/types'

type Props = {
  aggregate: CollaborationAggregate
}

export const CollaborationBadge: FC<Props> = ({ aggregate }) => {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12px] text-slate-100">
      <span className="inline-flex items-center gap-1">
        <Users className="h-3.5 w-3.5 text-slate-300" aria-hidden />
        Editors: {aggregate.editors}
      </span>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3.5 w-3.5 text-slate-300" aria-hidden />
        Reviewers: {aggregate.reviewers}
      </span>
      <span className="inline-flex items-center gap-1">
        <Wrench className="h-3.5 w-3.5 text-slate-300" aria-hidden />
        Interventions: {aggregate.manualInterventions}
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3.5 w-3.5 text-slate-300" aria-hidden />
        Replays: {aggregate.replays}
      </span>
    </div>
  )
}

export default CollaborationBadge

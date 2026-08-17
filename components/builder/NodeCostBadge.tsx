import type { FC } from 'react'
import { Calculator } from 'lucide-react'
import type { CostEstimate } from '@/lib/ai/telemetry/costEstimator'

type Props = {
  estimate: CostEstimate
}

export const NodeCostBadge: FC<Props> = ({ estimate }) => {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
      aria-label="AI cost estimate"
      title="Estimates only; not pricing or billing"
    >
      <Calculator className="h-3 w-3 text-slate-400" aria-hidden />
      <span>
        ~{estimate.totalTokens} tok • est{' '}
        {estimate.estimatedCostRange[0].toFixed(6)}–
        {estimate.estimatedCostRange[1].toFixed(6)}
      </span>
    </div>
  )
}

export default NodeCostBadge

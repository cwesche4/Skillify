import type { FC } from 'react'
import { WalletMinimal } from 'lucide-react'
import type { CostEstimate } from '@/lib/ai/telemetry/costEstimator'

type Props = {
  estimates: CostEstimate[]
}

export const RunCostSummary: FC<Props> = ({ estimates }) => {
  const totalTokens = estimates.reduce((sum, e) => sum + e.totalTokens, 0)
  const low = estimates.reduce((sum, e) => sum + e.estimatedCostRange[0], 0)
  const high = estimates.reduce((sum, e) => sum + e.estimatedCostRange[1], 0)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="flex items-center gap-2">
        <WalletMinimal className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="font-semibold">Run Cost (Estimate)</span>
      </div>
      <div className="mt-1 text-[12px] text-slate-300">
        Tokens: ~{totalTokens} • Est: {low.toFixed(6)}–{high.toFixed(6)}
      </div>
      <div className="text-[10px] text-slate-500">
        Estimates only; not pricing/billing. Execution not blocked.
      </div>
    </div>
  )
}

export default RunCostSummary

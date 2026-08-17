import type { FC } from 'react'
import { computeFlowInsights } from '@/lib/analytics/flowInsights'

type Props = {
  stats: Parameters<typeof computeFlowInsights>[0]
}

export const FlowInsightsPanel: FC<Props> = ({ stats }) => {
  const insights = computeFlowInsights(stats)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="font-semibold text-slate-200">Performance Insights</div>
      <div className="mt-1 text-[11px] text-slate-400">
        Observational metrics only; no optimization suggestions.
      </div>
      <div className="mt-2 space-y-2">
        {insights.map((i) => (
          <div
            key={i.nodeId}
            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[12px]"
          >
            <div className="flex items-center justify-between text-slate-200">
              <span>{i.nodeLabel ?? i.nodeId}</span>
              <span className="text-[11px] text-slate-400">
                Node {i.nodeId}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-300">
              <span>Failures: {i.failures}</span>
              <span>Avg duration: {i.avgDurationMs}ms</span>
              <span>Retries: {i.retryCount}</span>
              <span>SLA breaches: {i.slaBreaches}</span>
            </div>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="text-[12px] text-slate-400">
            No insights available.
          </div>
        )}
      </div>
    </div>
  )
}

export default FlowInsightsPanel

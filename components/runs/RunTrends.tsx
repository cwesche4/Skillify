import type { FC } from 'react'
import { computeTrends, type RunTrendPoint } from '@/lib/runs/analytics/trends'

type Props = {
  points: RunTrendPoint[]
}

export const RunTrends: FC<Props> = ({ points }) => {
  const trends = computeTrends(points)
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="font-semibold text-slate-200">Execution Trends</div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[12px] text-slate-300">
        <span>Success: {trends.statusCounts.success}</span>
        <span>Partial: {trends.statusCounts['partial-failure']}</span>
        <span>Failed: {trends.statusCounts.failed}</span>
      </div>
      <div className="mt-1 text-[12px] text-slate-300">
        Cost (est): {trends.costRange[0].toFixed(6)}–
        {trends.costRange[1].toFixed(6)}
      </div>
      <div className="mt-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          Branch Frequency
        </div>
        <ul className="mt-1 space-y-1 text-[12px] text-slate-200">
          {Object.entries(trends.branchFrequency).map(([sig, count]) => (
            <li key={sig}>
              {sig}: {count}
            </li>
          ))}
          {Object.keys(trends.branchFrequency).length === 0 && (
            <li className="text-slate-400">No branch data.</li>
          )}
        </ul>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        Observational only; no optimization suggestions.
      </div>
    </div>
  )
}

export default RunTrends

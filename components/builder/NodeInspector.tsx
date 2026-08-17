import type { FC } from 'react'
import type { NodeIssue } from '@/lib/builder/validation/validateFlow'
import NodeRuntimeSummary from './NodeRuntimeSummary'
import NodeCostBadge from './NodeCostBadge'
import type { CostEstimate } from '@/lib/ai/telemetry/costEstimator'

type Props = {
  title: string
  configContent?: React.ReactNode
  issues?: NodeIssue[]
  costEstimate?: CostEstimate
  lastOutcome?: 'success' | 'failed' | 'skipped'
  lastMessage?: string
  logSummary?: string
}

export const NodeInspector: FC<Props> = ({
  title,
  configContent,
  issues,
  costEstimate,
  lastOutcome,
  lastMessage,
  logSummary,
}) => {
  return (
    <div className="flex flex-col gap-3 rounded border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100">
      <div className="text-sm font-semibold text-slate-100">{title}</div>

      {configContent ? (
        <div className="rounded border border-slate-800 bg-slate-900 px-2 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Config
          </div>
          {configContent}
        </div>
      ) : null}

      {issues && issues.length ? (
        <div className="rounded border border-amber-800/60 bg-amber-950/30 px-2 py-2">
          <div className="text-[11px] uppercase tracking-wide text-amber-200">
            Validation Issues
          </div>
          <ul className="mt-1 space-y-1 text-[11px] text-amber-100">
            {issues.map((i, idx) => (
              <li key={idx}>• {i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {costEstimate ? (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Cost (estimate)
          </div>
          <NodeCostBadge estimate={costEstimate} />
        </div>
      ) : null}

      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          Runtime
        </div>
        <NodeRuntimeSummary
          lastOutcome={lastOutcome}
          lastMessage={lastMessage}
          logSummary={logSummary}
        />
      </div>
    </div>
  )
}

export default NodeInspector

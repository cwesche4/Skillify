import type { FC } from 'react'
import type { UsageAggregate } from '@/lib/usage/types'
import UsageBadge from './UsageBadge'

type Props = {
  usage: UsageAggregate
}

export const UsagePanel: FC<Props> = ({ usage }) => {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-100">
          Usage (soft limits, non-blocking)
        </span>
        <UsageBadge warnings={usage.warnings} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-[12px] text-slate-300">
        <div>
          <div className="text-slate-200">Runs</div>
          <div className="text-lg font-semibold text-slate-50">
            {usage.totals.runs}
          </div>
        </div>
        <div>
          <div className="text-slate-200">AI node executions</div>
          <div className="text-lg font-semibold text-slate-50">
            {usage.totals.aiNodes}
          </div>
        </div>
        <div>
          <div className="text-slate-200">Tokens</div>
          <div className="text-lg font-semibold text-slate-50">
            {usage.totals.tokens}
          </div>
        </div>
      </div>
      {usage.warnings.length > 0 ? (
        <div className="mt-3 space-y-1 text-[12px] text-amber-100">
          {usage.warnings.map((w, idx) => (
            <div
              key={`${w.metric}-${w.date}-${idx}`}
              className="rounded border border-amber-600/60 bg-amber-600/10 px-2 py-1"
            >
              <div className="font-semibold capitalize">{w.metric}</div>
              <div>{w.message}</div>
              <div className="text-[11px] text-amber-200/80">
                Date: {w.date}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default UsagePanel

import type { FC } from 'react'
import type { RunDiffSummary as RunDiffSummaryData } from '@/lib/runs/diff/computeRunDiff'

type Props = {
  summary: RunDiffSummaryData
}

export const RunDiffSummary: FC<Props> = ({ summary }) => {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="font-semibold text-slate-200">Execution Diff Summary</div>
      <div className="mt-1 grid grid-cols-2 gap-1 text-[12px] text-slate-300">
        <span>Added: {summary.added}</span>
        <span>Removed: {summary.removed}</span>
        <span>Changed: {summary.changed}</span>
        <span>Unchanged: {summary.same}</span>
        <span>Branch changes: {summary.branchChanges}</span>
        <span>Failures→Success: {summary.failuresToSuccess}</span>
        <span>Success→Failure: {summary.successToFailure}</span>
        <span>Token Δ: {summary.tokenDelta ?? 0}</span>
        <span>
          Cost Δ:{' '}
          {summary.costDelta
            ? `${summary.costDelta[0].toFixed(6)}–${summary.costDelta[1].toFixed(6)}`
            : '0'}
        </span>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        Execution-only comparison; no config or causality inference.
      </div>
    </div>
  )
}

export default RunDiffSummary

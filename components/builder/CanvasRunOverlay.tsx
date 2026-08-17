import type { FC } from 'react'
import { AlertTriangle, CheckCircle, CircleSlash, Info } from 'lucide-react'
import type { TimelineItem } from '@/lib/runs/timeline/types'
import { computeRunStatus } from '@/lib/runs/status/computeRunStatus'
import PartialFailureBadge from '@/components/runs/PartialFailureBadge'

type Props = {
  items: TimelineItem[]
}

const RunStatusSummary: FC<{ status: ReturnType<typeof computeRunStatus> }> = ({
  status,
}) => {
  if (status === 'success') {
    return (
      <div className="inline-flex items-center gap-2 rounded border border-emerald-600/70 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-100">
        <CheckCircle className="h-4 w-4" aria-hidden />
        Run completed successfully
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="inline-flex items-center gap-2 rounded border border-rose-600/70 bg-rose-600/10 px-3 py-2 text-sm text-rose-100">
        <CircleSlash className="h-4 w-4" aria-hidden />
        Run failed
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 rounded border border-amber-600/70 bg-amber-600/10 px-3 py-2 text-sm text-amber-100">
      <PartialFailureBadge label="Run completed with partial failures" />
    </div>
  )
}

export const CanvasRunOverlay: FC<Props> = ({ items }) => {
  const status = computeRunStatus(items)

  const branchNotes = items.filter(
    (item) =>
      item.type === 'node-skipped' || item.type === 'node-partial-failure',
  )

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-20 space-y-3 md:inset-x-8">
      <div className="pointer-events-auto">
        <RunStatusSummary status={status} />
      </div>
      {branchNotes.length > 0 ? (
        <div className="pointer-events-auto rounded border border-slate-700 bg-slate-900/90 px-3 py-2 text-[12px] text-slate-100 shadow-lg">
          <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-slate-200">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Branch outcomes
          </div>
          <ul className="space-y-1 text-[12px] text-slate-300">
            {branchNotes.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-[2px] h-3 w-3 text-amber-400"
                  aria-hidden
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-100">{item.title}</div>
                  {item.subtitle ? (
                    <div className="text-[11px] text-slate-400">
                      {item.subtitle}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default CanvasRunOverlay

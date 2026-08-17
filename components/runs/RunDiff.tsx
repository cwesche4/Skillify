import type { FC } from 'react'
import type { RunDiffItem } from '@/lib/runs/diff/computeRunDiff'

type Props = {
  items: RunDiffItem[]
}

const statusClass = (status: RunDiffItem['status']) => {
  switch (status) {
    case 'added':
      return 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100'
    case 'removed':
      return 'border-rose-700/60 bg-rose-950/40 text-rose-100'
    case 'changed':
      return 'border-amber-700/60 bg-amber-950/40 text-amber-100'
    default:
      return 'border-slate-800 bg-slate-950 text-slate-100'
  }
}

const statusLabel = (status: RunDiffItem['status']) => {
  switch (status) {
    case 'added':
      return 'Added'
    case 'removed':
      return 'Removed'
    case 'changed':
      return 'Changed'
    default:
      return 'Unchanged'
  }
}

export const RunDiff: FC<Props> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 gap-2">
      {items.map((item) => (
        <div
          key={item.id ?? `${item.nodeId}-${item.status}`}
          className={`rounded border px-3 py-2 text-sm ${statusClass(item.status)}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {item.label || item.nodeId || 'Node'}
            </span>
            <span className="text-[11px] uppercase tracking-wide">
              {statusLabel(item.status)}
            </span>
          </div>
          {item.reason ? (
            <div className="text-[11px] text-slate-200">{item.reason}</div>
          ) : null}
          <div className="mt-1 text-[11px] text-slate-300">
            {item.from?.status ? `From: ${item.from.status}` : null}
            {item.to?.status ? ` → To: ${item.to.status}` : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export default RunDiff

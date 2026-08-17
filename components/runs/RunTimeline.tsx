import type { FC } from 'react'
import { AlertTriangle, CheckCircle, Info, Slash, Timer } from 'lucide-react'
import type { TimelineItem } from '@/lib/runs/timeline/types'
import { TimelineEventDetail } from './TimelineEventDetail'

type Props = {
  items: TimelineItem[]
  onJumpToNode?: (nodeId: string, append?: boolean) => void
}

const statusIcon = (status: TimelineItem['status']) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden />
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden />
    case 'skipped':
      return <Slash className="h-4 w-4 text-slate-400" aria-hidden />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
    default:
      return <Info className="h-4 w-4 text-slate-300" aria-hidden />
  }
}

const statusColor = (status: TimelineItem['status']) => {
  switch (status) {
    case 'success':
      return 'border-emerald-600'
    case 'failed':
      return 'border-rose-600'
    case 'skipped':
      return 'border-slate-600'
    case 'warning':
      return 'border-amber-600'
    default:
      return 'border-slate-700'
  }
}

export const RunTimeline: FC<Props> = ({ items, onJumpToNode }) => {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="relative cursor-pointer pl-6"
          onClick={(e) => {
            const targetNodeId =
              (item.details && item.details.nodeId) ||
              (item as any).nodeId ||
              item.details?.node
            if (targetNodeId && onJumpToNode)
              onJumpToNode(targetNodeId, e.shiftKey)
          }}
        >
          {idx < items.length - 1 && (
            <div className="absolute left-3 top-5 h-full w-px bg-slate-800" />
          )}
          <div
            className={`relative flex items-start gap-2 rounded border bg-slate-950 px-3 py-2 ${statusColor(item.status)}`}
          >
            <div className="mt-0.5">{statusIcon(item.status)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm text-slate-100">
                <span className="font-semibold">{item.title}</span>
                <span className="text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" aria-hidden />
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </span>
              </div>
              <TimelineEventDetail item={item} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default RunTimeline

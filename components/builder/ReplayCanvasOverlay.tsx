import type { FC } from 'react'
import { Play, Pause } from 'lucide-react'
import type { TimelineItem } from '@/lib/runs/timeline/types'

type Props = {
  items: TimelineItem[]
  currentIndex: number
}

export const ReplayCanvasOverlay: FC<Props> = ({ items, currentIndex }) => {
  const current = items[currentIndex]
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {current?.nodeId ? (
        <div className="pointer-events-none absolute right-4 top-4 rounded border border-emerald-600/60 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-100 shadow-lg">
          <div className="flex items-center gap-2 font-semibold">
            <Play className="h-4 w-4" aria-hidden />
            Replaying node
          </div>
          <div className="text-[12px] text-emerald-50">
            {current.nodeLabel ?? current.nodeId}
          </div>
          {current.nodeType ? (
            <div className="text-[11px] text-emerald-100/80">
              {current.nodeType}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pointer-events-none absolute right-4 top-4 rounded border border-slate-600/70 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 shadow-lg">
          <div className="flex items-center gap-2 font-semibold">
            <Pause className="h-4 w-4" aria-hidden />
            Timeline replay active
          </div>
          <div className="text-[11px] text-slate-300">
            Canvas state is read-only
          </div>
        </div>
      )}
    </div>
  )
}

export default ReplayCanvasOverlay

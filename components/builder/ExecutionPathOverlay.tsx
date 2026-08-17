import type { FC } from 'react'
import type { TimelineItem } from '@/lib/runs/timeline/types'
import { cn } from '@/lib/ui/cn'

type Props = {
  activeNodeIds?: Set<string>
  failedNodeIds?: Set<string>
  dimmedNodeIds?: Set<string>
  onClear?: () => void
}

export const ExecutionPathOverlay: FC<Props> = ({
  activeNodeIds = new Set(),
  failedNodeIds = new Set(),
  dimmedNodeIds = new Set(),
  onClear,
}) => {
  // This component is a visual helper; actual highlighting wiring should map to canvas node classes.
  // Here we only render state indicators; integration with canvas node styling is expected elsewhere.
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      onClick={onClear}
    >
      <div className="absolute right-4 top-4 space-y-1 rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-[12px] text-slate-100 shadow-lg">
        <div className="font-semibold text-slate-100">Execution path</div>
        <div className="text-slate-300">
          Active:{' '}
          {activeNodeIds.size ? Array.from(activeNodeIds).join(', ') : 'None'}
        </div>
        <div
          className={cn(
            'text-slate-300',
            failedNodeIds.size ? 'text-rose-200' : '',
          )}
        >
          Failed nodes: {failedNodeIds.size}
        </div>
        <div className="text-slate-300">Dimmed: {dimmedNodeIds.size}</div>
      </div>
    </div>
  )
}

export default ExecutionPathOverlay

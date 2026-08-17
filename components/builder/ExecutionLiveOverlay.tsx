import type { FC } from 'react'
import { cn } from '@/lib/ui/cn'

type Props = {
  activeNodeId?: string
  completedNodeIds?: Set<string>
  skippedNodeIds?: Set<string>
  onClear?: () => void
}

export const ExecutionLiveOverlay: FC<Props> = ({
  activeNodeId,
  completedNodeIds = new Set(),
  skippedNodeIds = new Set(),
  onClear,
}) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      onClick={onClear}
    >
      <div className="absolute right-4 top-4 space-y-1 rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-[12px] text-slate-100 shadow-lg">
        <div className="font-semibold text-slate-100">Live execution</div>
        <div className="text-slate-300">Active: {activeNodeId ?? 'None'}</div>
        <div className="text-slate-300">Completed: {completedNodeIds.size}</div>
        <div
          className={cn(
            'text-slate-300',
            skippedNodeIds.size ? 'text-slate-400' : '',
          )}
        >
          Skipped: {skippedNodeIds.size}
        </div>
      </div>
    </div>
  )
}

export default ExecutionLiveOverlay

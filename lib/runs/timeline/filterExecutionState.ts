import { deriveLiveExecutionState } from './selectors'
import type { TimelineItem } from './types'

export type ExecutionFilterMode = 'none' | 'failed' | 'approval' | 'active'

// Execution filters.
// Read-only visualization only; never infer, persist, or control execution.
export function deriveExecutionFilterSets(items: TimelineItem[]): {
  failedNodes: Set<string>
  approvalNodes: Set<string>
  activePathNodes: Set<string>
} {
  const failedNodes = new Set<string>()
  const approvalNodes = new Set<string>()

  items.forEach((item) => {
    const nodeId = (item.details && item.details.nodeId) || (item as any).nodeId
    if (!nodeId) return
    if (item.status === 'failed' || item.type === 'node-partial-failure') {
      failedNodes.add(nodeId)
    }
    if (item.type === 'approval-requested') approvalNodes.add(nodeId)
  })

  const live = deriveLiveExecutionState(items)
  const activePathNodes = new Set<string>()
  if (live.activeNodeId) activePathNodes.add(live.activeNodeId)
  live.completedNodeIds.forEach((id) => activePathNodes.add(id))

  return { failedNodes, approvalNodes, activePathNodes }
}

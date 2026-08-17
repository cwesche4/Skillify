import type { TimelineItem } from './types'

export function filterTimelineByRun(
  items: TimelineItem[],
  runId: string,
): TimelineItem[] {
  return items.filter(
    (i) => (i as any).runId === runId || i.details?.runId === runId,
  )
}

export function deriveLiveExecutionState(items: TimelineItem[]): {
  activeNodeId?: string
  completedNodeIds: Set<string>
  skippedNodeIds: Set<string>
} {
  let activeNodeId: string | undefined = undefined
  const completedNodeIds = new Set<string>()
  const skippedNodeIds = new Set<string>()

  const sorted = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  for (const item of sorted) {
    const nodeId = (item.details && item.details.nodeId) || (item as any).nodeId
    switch (item.type) {
      case 'node-entered':
        if (nodeId) {
          activeNodeId = nodeId
          completedNodeIds.delete(nodeId)
          skippedNodeIds.delete(nodeId)
        }
        break
      case 'node-completed':
        if (nodeId) {
          completedNodeIds.add(nodeId)
          if (activeNodeId === nodeId) activeNodeId = undefined
        }
        break
      case 'node-skipped':
        if (nodeId) {
          skippedNodeIds.add(nodeId)
          if (activeNodeId === nodeId) activeNodeId = undefined
        }
        break
      case 'run-completed':
      case 'run-failed':
        activeNodeId = undefined
        break
      default:
        break
    }
  }

  return { activeNodeId, completedNodeIds, skippedNodeIds }
}

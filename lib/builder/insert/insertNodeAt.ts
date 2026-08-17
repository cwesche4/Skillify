import type { XYPosition } from 'reactflow'
import type { Node } from '@/lib/builder/types'

export function insertNodeAt(
  nodes: Node[],
  newNode: Node,
  position: XYPosition,
): Node[] {
  const defaults = newNode.data?.workspaceDefaults
  return [
    ...nodes,
    {
      ...newNode,
      position,
      positionAbsolute: position,
      data: {
        ...(newNode.data || {}),
        __justCreated: true,
        retryCount:
          newNode.data?.retryCount ??
          defaults?.retryCount ??
          newNode.data?.retryCount,
        timeoutMs:
          newNode.data?.timeoutMs ??
          defaults?.timeoutMs ??
          newNode.data?.timeoutMs,
        aiModel:
          newNode.data?.aiModel ?? defaults?.aiModel ?? newNode.data?.aiModel,
      },
      selected: true,
    },
  ]
}

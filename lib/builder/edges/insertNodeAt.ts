import type { XYPosition } from 'reactflow'
import type { Node } from '@/lib/builder/types'

// Helper to insert a node at a specific position in an edge-first flow.
// Builder-only UX; no execution impact.
export function insertNodeAt(
  nodes: Node[],
  newNode: Node,
  position: XYPosition,
): Node[] {
  return [
    ...nodes,
    {
      ...newNode,
      position,
      positionAbsolute: position,
      data: {
        ...(newNode.data || {}),
        __justCreated: true,
      },
      selected: true,
    },
  ]
}

import type { Node } from 'reactflow'

// Builder-only node labeling.
// Must not affect execution, routing, or inference.
export function updateNodeLabel(
  nodes: Node[],
  nodeId: string,
  label: string,
  secondaryLabel?: string,
): Node[] {
  return nodes.map((n) =>
    n.id === nodeId
      ? {
          ...n,
          data: {
            ...(n.data || {}),
            label,
            secondaryLabel,
          },
        }
      : n,
  )
}

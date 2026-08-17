import type { Node, Edge } from 'reactflow'

export type DiffResult = {
  addedNodes: string[]
  removedNodes: string[]
  changedNodes: string[]
  addedEdges: string[]
  removedEdges: string[]
}

// Diff preview.
// Informational only.
// No execution or inference.
export function computeDiff({
  currentNodes,
  currentEdges,
  baselineNodes,
  baselineEdges,
}: {
  currentNodes: Node[]
  currentEdges: Edge[]
  baselineNodes: Node[]
  baselineEdges: Edge[]
}): DiffResult {
  const baselineNodeIds = new Set(baselineNodes.map((n) => n.id))
  const currentNodeIds = new Set(currentNodes.map((n) => n.id))

  const addedNodes = currentNodes
    .filter((n) => !baselineNodeIds.has(n.id))
    .map((n) => n.id)
  const removedNodes = baselineNodes
    .filter((n) => !currentNodeIds.has(n.id))
    .map((n) => n.id)

  const changedNodes = currentNodes
    .filter((n) => baselineNodeIds.has(n.id))
    .filter((n) => {
      const base = baselineNodes.find((b) => b.id === n.id)
      return JSON.stringify(base?.data) !== JSON.stringify(n.data)
    })
    .map((n) => n.id)

  const baselineEdgeIds = new Set(baselineEdges.map((e) => e.id))
  const currentEdgeIds = new Set(currentEdges.map((e) => e.id))

  const addedEdges = currentEdges
    .filter((e) => !baselineEdgeIds.has(e.id))
    .map((e) => e.id)
  const removedEdges = baselineEdges
    .filter((e) => !currentEdgeIds.has(e.id))
    .map((e) => e.id)

  return { addedNodes, removedNodes, changedNodes, addedEdges, removedEdges }
}

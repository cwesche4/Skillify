import { nanoid } from 'nanoid'
import type { Edge, Node } from 'reactflow'
import { computeOffset } from './computeOffset'

type DuplicateResult = {
  nodes: Node[]
  edges: Edge[]
  selection: string[]
}

// Builder-only duplication.
// Must not affect execution, persistence, or inference.
export function duplicateSelection(params: {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
}): DuplicateResult | null {
  const { nodes, edges, selectedNodeIds } = params
  if (selectedNodeIds.length === 0) return null

  const selectedSet = new Set(selectedNodeIds)
  const { dx, dy } = computeOffset()

  const idMap = new Map<string, string>()
  const duplicatedNodes: Node[] = []
  let markedFirst = false

  for (const node of nodes) {
    if (!selectedSet.has(node.id)) continue
    const newId = nanoid()
    idMap.set(node.id, newId)
    duplicatedNodes.push({
      ...node,
      id: newId,
      position: {
        x: (node.position?.x ?? 0) + dx,
        y: (node.position?.y ?? 0) + dy,
      },
      selected: true,
      data: markedFirst
        ? node.data
        : {
            ...(node.data || {}),
            __justCreated: true,
          },
    })
    if (!markedFirst) markedFirst = true
  }

  const duplicatedEdges: Edge[] = []
  for (const edge of edges) {
    if (selectedSet.has(edge.source) && selectedSet.has(edge.target)) {
      const newSource = idMap.get(edge.source)
      const newTarget = idMap.get(edge.target)
      if (newSource && newTarget) {
        duplicatedEdges.push({
          ...edge,
          id: nanoid(),
          source: newSource,
          target: newTarget,
        })
      }
    }
  }

  const clearedOriginals = nodes.map((n) =>
    selectedSet.has(n.id) ? { ...n, selected: false } : n,
  )

  return {
    nodes: [...clearedOriginals, ...duplicatedNodes],
    edges: [...edges, ...duplicatedEdges],
    selection: duplicatedNodes.map((n) => n.id),
  }
}

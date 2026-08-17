import type { Edge, Node } from 'reactflow'
import { savePattern } from './store'
import { nanoid } from 'nanoid'

type SaveParams = {
  name: string
  description?: string
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
}

export function saveSelectedPattern(params: SaveParams) {
  // Builder-only patterns.
  // Static snapshots only.
  // No execution logic, inference, or auto-wiring.
  const { name, description, nodes, edges, selectedNodeIds } = params
  const selectedSet = new Set(selectedNodeIds)
  const chosenNodes = nodes.filter((n) => selectedSet.has(n.id))
  if (chosenNodes.length === 0) return

  const minX = Math.min(...chosenNodes.map((n) => n.position.x))
  const minY = Math.min(...chosenNodes.map((n) => n.position.y))

  const nodeMap = new Map<string, string>()
  const patternNodes = chosenNodes.map((n) => {
    const newId = nanoid()
    nodeMap.set(n.id, newId)
    return {
      ...n,
      id: newId,
      position: {
        x: n.position.x - minX,
        y: n.position.y - minY,
      },
      selected: false,
    }
  })

  const patternEdges = edges
    .filter((e) => selectedSet.has(e.source) && selectedSet.has(e.target))
    .map((e) => ({
      ...e,
      id: nanoid(),
      source: nodeMap.get(e.source) ?? e.source,
      target: nodeMap.get(e.target) ?? e.target,
    }))

  savePattern({
    id: nanoid(),
    name,
    description,
    nodes: patternNodes,
    edges: patternEdges,
    createdAt: new Date().toISOString(),
  })
}

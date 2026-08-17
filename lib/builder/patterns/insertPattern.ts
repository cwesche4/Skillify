import type { Edge, Node, XYPosition } from 'reactflow'
import { nanoid } from 'nanoid'
import type { MicroPattern } from './store'
import { computeOffset } from '@/lib/builder/duplicate/computeOffset'

export function insertPatternAt(params: {
  pattern: MicroPattern
  nodes: Node[]
  edges: Edge[]
  position: XYPosition
}): { nodes: Node[]; edges: Edge[]; selection: string[] } {
  // Builder-only patterns.
  // Static snapshots only.
  // No execution logic, inference, or auto-wiring.
  const { pattern, nodes, edges, position } = params
  const { dx, dy } = computeOffset()

  const insertedIds: string[] = []
  const newNodes = pattern.nodes.map((n, idx) => {
    const id = nanoid()
    insertedIds.push(id)
    return {
      ...n,
      id,
      position: {
        x: position.x + n.position.x + dx,
        y: position.y + n.position.y + dy,
      },
      selected: true,
      data: idx === 0 ? { ...(n.data || {}), __justCreated: true } : n.data,
    } as Node
  })

  const idMap = new Map<string, string>()
  pattern.nodes.forEach((n, idx) => idMap.set(n.id, insertedIds[idx]))

  const newEdges = pattern.edges
    .map((e) => {
      const source = idMap.get(e.source)
      const target = idMap.get(e.target)
      if (!source || !target) return null
      return {
        ...e,
        id: nanoid(),
        source,
        target,
      } as Edge
    })
    .filter(Boolean) as Edge[]

  return {
    nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
    edges: [...edges, ...newEdges],
    selection: insertedIds,
  }
}

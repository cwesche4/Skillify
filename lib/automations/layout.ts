// lib/automations/layout.ts
import type { Node, Edge } from 'reactflow'

export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'vertical' | 'horizontal' = 'vertical',
): Node[] {
  const spacing = 180

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]))
  const incoming = new Map(nodes.map((n) => [n.id, 0]))

  edges.forEach((e) => {
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
  })

  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0)

  let queue = [...roots]
  let layer = 0

  while (queue.length) {
    const next: Node[] = []
    queue.forEach((node, index) => {
      const base = nodeMap.get(node.id) ?? node
      const updated: Node = {
        ...base,
        position: {
          x: direction === 'horizontal' ? layer * spacing : index * spacing,
          y: direction === 'horizontal' ? index * spacing : layer * spacing,
        },
      }
      nodeMap.set(node.id, updated)

      edges
        .filter((e) => e.source === node.id)
        .forEach((e) => {
          const target = nodeMap.get(e.target)
          if (target) next.push(target)
        })
    })

    queue = next
    layer++
  }

  return [...nodeMap.values()]
}

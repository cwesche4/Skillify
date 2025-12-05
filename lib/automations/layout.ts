import type { Node, Edge } from "reactflow"

export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "vertical" | "horizontal" = "vertical",
): Node[] {
  const spacing = 180

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map(nodes.map((n) => [n.id, 0]))

  edges.forEach((e) => {
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
  })

  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0)

  let queue = [...roots]
  let layer = 0

  const newNodes = [...nodes]

  while (queue.length) {
    const next: Node[] = []
    queue.forEach((node, index) => {
      const updated = {
        ...node,
        position: {
          x: direction === "horizontal" ? layer * spacing : index * spacing,
          y: direction === "horizontal" ? index * spacing : layer * spacing,
        },
      }
      nodeMap.set(node.id, updated)

      newNodes.push(updated)

      edges
        .filter((e) => e.source === node.id)
        .forEach((e) => {
          next.push(nodeMap.get(e.target)!)
        })
    })

    queue = next
    layer++
  }

  return [...nodeMap.values()]
}

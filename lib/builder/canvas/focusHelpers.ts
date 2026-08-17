import type { ReactFlowInstance, Node } from 'reactflow'

// Canvas focus helpers.
// Triggered by explicit user intent only.
export function focusOnNode(rf: ReactFlowInstance | null, nodeId: string) {
  if (!rf) return
  const node = rf.getNode(nodeId) as Node | undefined
  if (!node || !node.positionAbsolute) return
  const { positionAbsolute } = node
  const width = node.width ?? 0
  const height = node.height ?? 0
  rf.setCenter(
    positionAbsolute.x + width / 2,
    positionAbsolute.y + height / 2,
    {
      duration: 200,
      zoom: 1.2,
    },
  )
}

export function focusOnNodes(rf: ReactFlowInstance | null, nodeIds: string[]) {
  if (!rf || nodeIds.length === 0) return
  const nodes = nodeIds
    .map((id) => rf.getNode(id) as Node | undefined)
    .filter((n): n is Node => Boolean(n && n.positionAbsolute))
  if (nodes.length === 0) return
  const xs = nodes.map((n) => n.positionAbsolute!.x)
  const ys = nodes.map((n) => n.positionAbsolute!.y)
  const widths = nodes.map((n) => n.width ?? 0)
  const heights = nodes.map((n) => n.height ?? 0)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs.map((x, i) => x + widths[i]))
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys.map((y, i) => y + heights[i]))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  rf.setCenter(centerX, centerY, { duration: 200, zoom: 1.0 })
}

export function zoomToSelection(
  rf: ReactFlowInstance | null,
  nodeIds: string[],
) {
  focusOnNodes(rf, nodeIds)
}

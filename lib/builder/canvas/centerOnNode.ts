import type { ReactFlowInstance } from 'reactflow'

export function centerCanvasOnNode(
  rf: ReactFlowInstance | null,
  nodeId: string,
) {
  if (!rf) return
  const node = rf.getNode(nodeId)
  if (!node) return
  const { positionAbsolute } = node
  const width = node.width ?? 0
  const height = node.height ?? 0
  if (!positionAbsolute) return
  rf.setCenter(
    positionAbsolute.x + width / 2,
    positionAbsolute.y + height / 2,
    {
      duration: 200,
      zoom: 1.2,
    },
  )
}

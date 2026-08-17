import { useMemo } from 'react'
import type { Node } from 'reactflow'

type Viewport = {
  x: number
  y: number
  zoom: number
  width: number
  height: number
}

// Performance hardening.
// No behavior or execution changes.
export function useVirtualNodes(
  nodes: Node[],
  viewport?: Viewport | null,
  margin = 400,
): Node[] {
  return useMemo(() => {
    if (!viewport || !viewport.width || !viewport.height) return nodes
    const left = -viewport.x / viewport.zoom
    const top = -viewport.y / viewport.zoom
    const width = viewport.width / viewport.zoom
    const height = viewport.height / viewport.zoom
    const padded = {
      left: left - margin,
      right: left + width + margin,
      top: top - margin,
      bottom: top + height + margin,
    }
    return nodes.filter((n) => {
      const { x, y } = n.position
      return (
        x >= padded.left &&
        x <= padded.right &&
        y >= padded.top &&
        y <= padded.bottom
      )
    })
  }, [nodes, viewport, margin])
}

export default useVirtualNodes

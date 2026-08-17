import { useMemo } from 'react'
import type { Edge } from 'reactflow'

type Viewport = {
  zoom: number
}

// Performance hardening.
// No behavior or execution changes.
export function useEdgeLOD(edges: Edge[], viewport?: Viewport | null): Edge[] {
  return useMemo(() => {
    if (!viewport) return edges
    // At very low zoom, strip heavy edge props; keep connectivity intact.
    const simple = viewport.zoom < 0.4
    if (!simple) return edges
    return edges.map((edge) => ({
      ...edge,
      animated: false,
      label: undefined,
    }))
  }, [edges, viewport])
}

export default useEdgeLOD

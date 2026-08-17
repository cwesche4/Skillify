import { useMemo } from 'react'
import type { Edge, Node, OnEdgesChange, OnNodesChange } from 'reactflow'

// Memoize heavy ReactFlow props to reduce re-renders of large graphs.
export function useCanvasPerf(
  nodes: Node[],
  edges: Edge[],
  handlers: { onNodesChange: OnNodesChange; onEdgesChange: OnEdgesChange },
) {
  const memoNodes = useMemo(() => nodes, [nodes])
  const memoEdges = useMemo(() => edges, [edges])
  const memoHandlers = useMemo(
    () => ({
      onNodesChange: handlers.onNodesChange,
      onEdgesChange: handlers.onEdgesChange,
    }),
    [handlers.onNodesChange, handlers.onEdgesChange],
  )

  return { memoNodes, memoEdges, memoHandlers }
}

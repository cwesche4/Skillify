'use client'

import React, { useMemo } from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import { useFlowStore } from '@/lib/builder/useFlowStore'
import { useCanvasPerf } from '@/lib/builder/performance/useCanvasPerf'
import 'reactflow/dist/style.css'

export default function Canvas() {
  const { nodes, edges, setNodes, setEdges } = useFlowStore()

  const { memoNodes, memoEdges, memoHandlers } = useCanvasPerf(nodes, edges, {
    onNodesChange: setNodes as any,
    onEdgesChange: setEdges as any,
  })

  // Avoid prop identity changes to reduce unnecessary renders
  const rfProps = useMemo(
    () => ({
      nodes: memoNodes,
      edges: memoEdges,
      onNodesChange: memoHandlers.onNodesChange,
      onEdgesChange: memoHandlers.onEdgesChange,
    }),
    [memoNodes, memoEdges, memoHandlers],
  )

  return (
    <div className="h-full flex-1">
      <ReactFlow {...rfProps} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

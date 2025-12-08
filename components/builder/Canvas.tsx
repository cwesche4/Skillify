'use client'

import React from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import { useFlowStore } from '@/lib/builder/useFlowStore'
import 'reactflow/dist/style.css'

export default function Canvas() {
  const { nodes, edges, setNodes, setEdges } = useFlowStore()

  return (
    <div className="h-full flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes as any}
        onEdgesChange={setEdges as any}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

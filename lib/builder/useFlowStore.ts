// -------------------------------------------------------------
// FILE: lib/builder/useFlowStore.ts
// -------------------------------------------------------------
'use client'

import { create } from 'zustand'
import { Node, Edge } from 'reactflow'
import { AutomationFlow, asAutomationFlow } from '@/lib/types/automation'

interface FlowStore {
  nodes: Node[]
  edges: Edge[]
  flowId: string | null

  setNodes: (n: Node[]) => void
  setEdges: (e: Edge[]) => void

  loadFlow: (rawFlow: any) => void
  clear: () => void
}

export const useFlowStore = create<FlowStore>((set) => ({
  nodes: [],
  edges: [],
  flowId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  loadFlow: (rawFlow: any) => {
    const flow: AutomationFlow = asAutomationFlow(rawFlow)
    set({
      flowId: flow.id,
      nodes: flow.nodes,
      edges: flow.edges,
    })
  },

  clear: () => set({ nodes: [], edges: [], flowId: null }),
}))

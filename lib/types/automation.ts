// -------------------------------------------------------------
// FILE: lib/types/automation.ts
// -------------------------------------------------------------

import type { Node, Edge } from 'reactflow'
import {
  parseFlowJson,
  type FlowNode,
  type FlowEdge,
} from '@/lib/builder/schema/flow'
// JSON-safe flow used in DB
export interface AutomationFlowJson {
  nodes: any[]
  edges: any[]
}

// Runtime flow used in builder
export interface AutomationFlow {
  id: string
  nodes: Node[]
  edges: Edge[]
}

// Convert unknown DB JSON → typed flow
export function asAutomationFlow(raw: any): AutomationFlow {
  const parsed = parseFlowJson(raw)
  return {
    id: parsed.id,
    // Backward compatible: FlowNode is assignable to ReactFlow Node with data/position
    nodes: parsed.nodes as FlowNode[] as Node[],
    edges: parsed.edges as FlowEdge[] as Edge[],
  }
}

// Automation with flow from Prisma
export interface AutomationWithFlow {
  id: string
  name: string
  description: string | null
  workspaceId: string
  userId: string
  status: string
  createdAt: Date
  updatedAt: Date

  flow: AutomationFlowJson
}

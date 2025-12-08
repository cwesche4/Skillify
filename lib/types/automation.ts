// -------------------------------------------------------------
// FILE: lib/types/automation.ts
// -------------------------------------------------------------

import type { Node, Edge } from 'reactflow'
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
  return {
    id: raw?.id ?? '',
    nodes: Array.isArray(raw?.nodes) ? raw.nodes : [],
    edges: Array.isArray(raw?.edges) ? raw.edges : [],
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

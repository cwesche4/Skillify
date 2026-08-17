import type { Node, Edge } from 'reactflow'

type GraphSummary = {
  nodeCount: number
  branchCount: number
  triggerTypes: string[]
  hasApproval: boolean
  hasAi: boolean
}

// Read-only builder context.
// No inference, prediction, or execution coupling.
export function deriveGraphSummary(nodes: Node[], edges: Edge[]): GraphSummary {
  const nodeCount = nodes.length
  const branchCount =
    edges.length > 0 ? Math.max(...edges.map((e) => Number(e.target))) || 0 : 0
  const triggerTypes = Array.from(
    new Set(
      nodes
        .filter((n) => n.type === 'Trigger')
        .map((n) => n.data?.type || 'Trigger'),
    ),
  )
  const hasApproval = nodes.some(
    (n) => n.type === 'Approval' || n.data?.requiresApproval,
  )
  const hasAi = nodes.some((n) => n.type === 'AI')

  return {
    nodeCount,
    branchCount,
    triggerTypes,
    hasApproval,
    hasAi,
  }
}

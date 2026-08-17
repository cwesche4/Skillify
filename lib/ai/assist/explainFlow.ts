import type { Node, Edge } from 'reactflow'

type Explanation = {
  summary: string
  nodes: Array<{ id: string; label?: string; type: string; role: string }>
  branches: string[]
  risks: string[]
}

/**
 * Explain-only helper; does not mutate flows.
 * Summaries are static and derived from structure only.
 */
export function explainFlow(nodes: Node[], edges: Edge[]): Explanation {
  const nodeSummaries = nodes.map((n) => {
    const type = n.type ?? 'unknown'
    return {
      id: n.id,
      label: (n.data as any)?.label,
      type,
      role: roleForType(type),
    }
  })

  const branches = edges.map((e) => `${e.source} → ${e.target}`)

  const risks: string[] = []
  if (!nodes.length) risks.push('Flow has no nodes.')
  if (!edges.length) risks.push('Flow has no connections; nothing will run.')

  return {
    summary: `Flow has ${nodes.length} nodes and ${edges.length} connections.`,
    nodes: nodeSummaries,
    branches,
    risks,
  }
}

function roleForType(type: string) {
  if (type.startsWith('ai-')) return 'AI'
  if (type === 'trigger') return 'Trigger'
  if (type === 'delay') return 'Delay'
  if (type === 'or-path' || type === 'ai-decision' || type === 'ai-classifier')
    return 'Branching'
  return 'Step'
}

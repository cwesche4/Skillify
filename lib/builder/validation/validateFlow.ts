import type { Edge, Node } from 'reactflow'
import { validateNodeData } from '@/lib/builder/node-schemas'
import { workflowFromReactFlow } from '@/lib/workflows/adapters'
import { validateWorkflow } from '@/lib/workflows/validation'

export type IssueSeverity = 'error' | 'warning'

export type IssueType =
  | 'missing-config'
  | 'invalid-connection'
  | 'circular-dependency'
  | 'disabled-node'
  | 'deprecated-node'

export interface NodeIssue {
  nodeId: string
  type: IssueType
  severity: IssueSeverity
  message: string
}

export interface FlowIssue {
  type: IssueType
  severity: IssueSeverity
  message: string
  nodes?: string[]
}

export interface FlowValidationResult {
  nodeIssues: NodeIssue[]
  flowIssues: FlowIssue[]
  hasBlockingErrors: boolean
}

const DEPRECATED_NODE_TYPES = ['legacy-node']

/**
 * Validate a flow for common builder errors.
 * - Purely analytical: no mutations.
 * - Errors are actionable and localized where possible.
 */
export function validateFlow(
  nodes: Node[],
  edges: Edge[],
): FlowValidationResult {
  const nodeIssues: NodeIssue[] = []
  const flowIssues: FlowIssue[] = []
  const workflowValidation = validateWorkflow(
    workflowFromReactFlow({
      id: 'builder-flow',
      workspaceId: 'preview',
      name: 'Builder flow',
      nodes,
      edges,
    }),
  )

  for (const item of workflowValidation.issues) {
    if (item.nodeId) {
      nodeIssues.push({
        nodeId: item.nodeId,
        type:
          item.code === 'cycle'
            ? 'circular-dependency'
            : item.code === 'invalid-edge'
              ? 'invalid-connection'
              : 'missing-config',
        severity: item.severity,
        message: item.message,
      })
    } else {
      flowIssues.push({
        type:
          item.code === 'cycle'
            ? 'circular-dependency'
            : item.code === 'invalid-edge'
              ? 'invalid-connection'
              : 'missing-config',
        severity: item.severity,
        message: item.message,
        nodes: item.nodeId ? [item.nodeId] : undefined,
      })
    }
  }

  const nodeMap = new Map<string, Node>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  // Missing/invalid config per node
  for (const node of nodes) {
    const nodeType = node.type ?? 'unknown'
    const result = validateNodeData(nodeType as any, node.data || {})
    if (!result.ok && result.errors.length) {
      nodeIssues.push({
        nodeId: node.id,
        type: 'missing-config',
        severity: 'error',
        message: result.errors.join(', '),
      })
    }

    if (node.data?.disabled) {
      nodeIssues.push({
        nodeId: node.id,
        type: 'disabled-node',
        severity: 'warning',
        message: 'Node is disabled and will not run.',
      })
    }

    if (DEPRECATED_NODE_TYPES.includes(nodeType)) {
      nodeIssues.push({
        nodeId: node.id,
        type: 'deprecated-node',
        severity: 'warning',
        message: 'Node type is deprecated; consider replacing.',
      })
    }
  }

  // Invalid connections (missing source/target nodes)
  for (const edge of edges) {
    if (!edge.source || !edge.target) {
      flowIssues.push({
        type: 'invalid-connection',
        severity: 'error',
        message: 'Edge is missing source or target.',
      })
      continue
    }
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      flowIssues.push({
        type: 'invalid-connection',
        severity: 'error',
        message: `Edge connects to missing node(s): ${edge.source} → ${edge.target}`,
      })
    }
  }

  // Circular dependency detection (simple DFS)
  const adjacency: Record<string, string[]> = {}
  for (const { source, target } of edges) {
    if (!source || !target) continue
    adjacency[source] = adjacency[source] || []
    adjacency[source].push(target)
  }

  const visited = new Set<string>()
  const stack = new Set<string>()
  const cycles: string[][] = []

  const dfs = (nodeId: string) => {
    if (stack.has(nodeId)) {
      cycles.push(Array.from(stack).concat(nodeId))
      return
    }
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    stack.add(nodeId)
    for (const next of adjacency[nodeId] || []) {
      dfs(next)
    }
    stack.delete(nodeId)
  }

  nodes.forEach((n) => dfs(n.id))

  if (cycles.length) {
    flowIssues.push({
      type: 'circular-dependency',
      severity: 'error',
      message:
        'Circular dependencies detected; resolve cycles before execution.',
      nodes: cycles.flat(),
    })
  }

  const hasBlockingErrors =
    nodeIssues.some((i) => i.severity === 'error') ||
    flowIssues.some((i) => i.severity === 'error')

  return { nodeIssues, flowIssues, hasBlockingErrors }
}

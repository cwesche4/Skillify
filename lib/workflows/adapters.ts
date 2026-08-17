import type { Edge, Node } from 'reactflow'

import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from '@/lib/workflows/types'

function getNodeLabel(node: Node) {
  const data = (node.data ?? {}) as { label?: unknown }
  return typeof data.label === 'string' && data.label.trim().length > 0
    ? data.label
    : (node.type ?? 'Unknown node')
}

export function workflowNodeFromReactFlow(node: Node): WorkflowNode {
  return {
    id: node.id,
    type: node.type ?? 'unknown',
    label: getNodeLabel(node),
    config: { ...(node.data ?? {}) },
    position: node.position,
    disabled: Boolean(
      (node.data as { disabled?: boolean } | undefined)?.disabled,
    ),
  }
}

export function workflowEdgeFromReactFlow(edge: Edge): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label:
      typeof edge.label === 'string'
        ? edge.label
        : typeof edge.data?.label === 'string'
          ? edge.data.label
          : undefined,
  }
}

export function workflowFromReactFlow({
  id,
  workspaceId,
  name,
  nodes,
  edges,
}: {
  id: string
  workspaceId: string
  name: string
  nodes: Node[]
  edges: Edge[]
}): Workflow {
  const workflowNodes = nodes.map(workflowNodeFromReactFlow)
  const triggerNode = workflowNodes.find(
    (node) =>
      node.type === 'trigger' ||
      node.type === 'crm-trigger' ||
      node.type.endsWith('.created') ||
      node.type.endsWith('.converted'),
  )

  return {
    id,
    workspaceId,
    name,
    status: 'draft',
    trigger: triggerNode
      ? {
          id: triggerNode.id,
          event:
            typeof triggerNode.config.event === 'string'
              ? triggerNode.config.event
              : triggerNode.type,
          source: triggerNode.type === 'trigger' ? 'manual' : 'crm',
          config: triggerNode.config,
        }
      : undefined,
    nodes: workflowNodes,
    edges: edges.map(workflowEdgeFromReactFlow),
  }
}

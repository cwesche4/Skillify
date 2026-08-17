import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type {
  Workflow,
  WorkflowNode,
  WorkflowValidationIssue,
  WorkflowValidationResult,
} from '@/lib/workflows/types'

function issue(
  code: WorkflowValidationIssue['code'],
  severity: WorkflowValidationIssue['severity'],
  message: string,
  detail?: Pick<WorkflowValidationIssue, 'nodeId' | 'edgeId'>,
): WorkflowValidationIssue {
  return {
    id: `${code}-${detail?.nodeId ?? detail?.edgeId ?? message}`,
    code,
    severity,
    message,
    ...detail,
  }
}

function isTriggerNode(node: WorkflowNode) {
  return (
    node.type === 'trigger' ||
    node.type === 'crm-trigger' ||
    node.type === 'crm.trigger' ||
    node.type.includes('.created') ||
    node.type.includes('.converted') ||
    node.type.includes('.completed') ||
    node.type.includes('.changed')
  )
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

export function validateWorkflow(workflow: Workflow): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = []
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]))
  const incoming = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  if (!workflow.trigger && !workflow.nodes.some(isTriggerNode)) {
    issues.push(
      issue(
        'missing-trigger',
        'error',
        'Workflow needs a trigger before it can run.',
      ),
    )
  }

  for (const node of workflow.nodes) {
    const definition = getWorkflowNodeDefinition(node.type)

    if (!definition && node.type === 'unknown') {
      issues.push(
        issue('unknown-node', 'error', 'Unsupported node type.', {
          nodeId: node.id,
        }),
      )
    }

    if (definition) {
      for (const field of definition.configFields) {
        if (field.required && !hasValue(node.config[field.id])) {
          issues.push(
            issue(
              'missing-config',
              'error',
              `${definition.label} requires ${field.label}.`,
              { nodeId: node.id },
            ),
          )
        }
      }

      const requiredInputs = definition.inputs.filter((input) => input.required)
      if (requiredInputs.length > 0 && !isTriggerNode(node)) {
        const inboundCount = workflow.edges.filter(
          (edge) => edge.target === node.id,
        ).length
        if (inboundCount === 0) {
          issues.push(
            issue(
              'missing-input',
              'warning',
              `${definition.label} expects input from an earlier node.`,
              { nodeId: node.id },
            ),
          )
        }
      }
    }
  }

  for (const edge of workflow.edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      issues.push(
        issue(
          'invalid-edge',
          'error',
          `Edge ${edge.id} references a missing source or target node.`,
          { edgeId: edge.id },
        ),
      )
      continue
    }

    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) ?? []),
      edge.target,
    ])
  }

  const triggerNodes = workflow.nodes.filter(isTriggerNode)
  const reachable = new Set<string>()
  const visit = (nodeId: string) => {
    if (reachable.has(nodeId)) return
    reachable.add(nodeId)
    for (const next of adjacency.get(nodeId) ?? []) visit(next)
  }
  triggerNodes.forEach((node) => visit(node.id))

  for (const node of workflow.nodes) {
    if (
      !isTriggerNode(node) &&
      triggerNodes.length > 0 &&
      !reachable.has(node.id)
    ) {
      issues.push(
        issue('unreachable-node', 'warning', `${node.label} is unreachable.`, {
          nodeId: node.id,
        }),
      )
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const detectCycle = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      issues.push(
        issue(
          'cycle',
          'error',
          'Workflow contains a loop that is not allowed.',
          {
            nodeId,
          },
        ),
      )
      return
    }
    if (visited.has(nodeId)) return
    visiting.add(nodeId)
    for (const next of adjacency.get(nodeId) ?? []) detectCycle(next)
    visiting.delete(nodeId)
    visited.add(nodeId)
  }
  workflow.nodes.forEach((node) => detectCycle(node.id))

  return {
    ok: !issues.some((item) => item.severity === 'error'),
    issues,
  }
}

import type { Edge, Node } from 'reactflow'

import {
  getBuilderNodeTypeForDefinition,
  getWorkflowNodeDefinition,
  isNodeAllowedForPlan,
  workflowNodeRegistry,
} from '@/lib/workflows/nodeRegistry'
import type {
  WorkflowConnectionRole,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'
import type { BuilderNodeType, PlanId } from '@/lib/builder/node-types'

export type WorkflowConnectionCheck = {
  valid: boolean
  reason?: string
}

export type WorkflowNodeRecommendation = {
  id: string
  type: BuilderNodeType
  label: string
  description: string
  definition: WorkflowNodeDefinition
  score: number
}

const COMMON_NEXT_STEPS: Record<string, string[]> = {
  trigger: [
    'condition.branch',
    'wait.delay',
    'crm.action',
    'send.email',
    'webhook.placeholder',
  ],
  logic: [
    'send.email',
    'send.sms',
    'crm.action',
    'webhook.placeholder',
    'wait.delay',
  ],
  action: [
    'wait.delay',
    'condition.branch',
    'send.email',
    'webhook.placeholder',
  ],
  utility: [
    'condition.branch',
    'send.email',
    'webhook.placeholder',
    'wait.delay',
  ],
  'ai-llm': [
    'ai.transform',
    'condition.branch',
    'webhook.placeholder',
    'wait.delay',
  ],
  'ai.generate_response': [
    'ai.transform',
    'condition.branch',
    'webhook.placeholder',
    'wait.delay',
  ],
}

export function getNodeRegistryDefinitionFromFlowNode(node: Node | undefined) {
  if (!node) return undefined
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return getWorkflowNodeDefinition(
    typeof registryNodeId === 'string'
      ? registryNodeId
      : (node.type ?? 'unknown'),
  )
}

function getRole(
  definition: WorkflowNodeDefinition | undefined,
): WorkflowConnectionRole {
  return (
    definition?.connectionRole ??
    (definition?.canBeTrigger ? 'trigger' : 'action')
  )
}

function roleLabel(role: WorkflowConnectionRole) {
  if (role === 'trigger') return 'Trigger'
  if (role === 'logic') return 'Logic'
  if (role === 'utility') return 'Utility'
  return 'Action'
}

function wouldCreateCycle({
  sourceId,
  targetId,
  edges,
}: {
  sourceId: string
  targetId: string
  edges: Edge[]
}) {
  const pending = [targetId]
  const visited = new Set<string>()
  while (pending.length) {
    const current = pending.shift()
    if (!current || visited.has(current)) continue
    if (current === sourceId) return true
    visited.add(current)
    for (const edge of edges) {
      if (edge.source === current) pending.push(edge.target)
    }
  }
  return false
}

export function validateWorkflowConnection({
  source,
  target,
  edges = [],
  sourceHandle = null,
  targetHandle = null,
}: {
  source: Node | undefined
  target: Node | undefined
  edges?: Edge[]
  sourceHandle?: string | null
  targetHandle?: string | null
}): WorkflowConnectionCheck {
  if (!source || !target) {
    return {
      valid: false,
      reason: 'This node does not accept this connection.',
    }
  }
  if (source.id === target.id) {
    return { valid: false, reason: 'A node cannot connect to itself.' }
  }

  const sourceDefinition = getNodeRegistryDefinitionFromFlowNode(source)
  const targetDefinition = getNodeRegistryDefinitionFromFlowNode(target)
  const sourceRole = getRole(sourceDefinition)
  const targetRole = getRole(targetDefinition)

  if (targetRole === 'trigger') {
    return {
      valid: false,
      reason:
        sourceRole === 'trigger'
          ? 'Triggers cannot connect to another Trigger.'
          : 'Actions cannot connect to a Trigger.',
    }
  }

  if (!sourceDefinition?.allowedOutputs?.includes(targetRole)) {
    return {
      valid: false,
      reason: `${roleLabel(sourceRole)} nodes cannot connect to ${roleLabel(targetRole)} nodes.`,
    }
  }

  if (!targetDefinition?.allowedInputs?.includes(sourceRole)) {
    return {
      valid: false,
      reason: 'This node does not accept this connection.',
    }
  }

  if (
    edges.some(
      (edge) =>
        edge.source === source.id &&
        edge.target === target.id &&
        (edge.sourceHandle ?? null) === sourceHandle &&
        (edge.targetHandle ?? null) === targetHandle,
    )
  ) {
    return {
      valid: false,
      reason: 'These steps are already connected.',
    }
  }

  if (wouldCreateCycle({ sourceId: source.id, targetId: target.id, edges })) {
    return {
      valid: false,
      reason: 'This connection would create a loop.',
    }
  }

  const outgoingEdges = edges.filter((edge) => edge.source === source.id)
  const canonicalSourceHandle =
    sourceDefinition.branchPaths?.find(
      (path) =>
        path.sourceHandle === sourceHandle ||
        (sourceHandle
          ? (path.handleAliases ?? []).includes(sourceHandle)
          : false),
    )?.sourceHandle ?? sourceHandle
  const outgoingFromHandle = outgoingEdges.filter((edge) => {
    const edgeHandle = edge.sourceHandle ?? null
    const canonicalEdgeHandle =
      sourceDefinition.branchPaths?.find(
        (path) =>
          path.sourceHandle === edgeHandle ||
          (edgeHandle
            ? (path.handleAliases ?? []).includes(edgeHandle)
            : false),
      )?.sourceHandle ?? edgeHandle
    return canonicalEdgeHandle === canonicalSourceHandle
  })
  const branchHandles = new Set(sourceDefinition.branchHandles ?? [])
  const handleLabel =
    sourceDefinition.branchPaths?.find(
      (path) => path.sourceHandle === canonicalSourceHandle,
    )?.pathLabel ??
    sourceDefinition.outputs.find(
      (output) => output.id === canonicalSourceHandle,
    )?.label ??
    canonicalSourceHandle

  if (
    canonicalSourceHandle &&
    branchHandles.has(canonicalSourceHandle) &&
    outgoingFromHandle.length > 0
  ) {
    return {
      valid: false,
      reason: handleLabel
        ? `The "${handleLabel}" branch already has a connected step.`
        : 'This branch already has a connected step.',
    }
  }

  if (
    typeof sourceDefinition.maxOutgoingConnections === 'number' &&
    outgoingEdges.length >= sourceDefinition.maxOutgoingConnections
  ) {
    return {
      valid: false,
      reason: 'This output supports only one connected step.',
    }
  }

  if (
    sourceDefinition.acceptsMultipleOutputs === false &&
    !sourceDefinition.allowsMultipleOutgoing &&
    outgoingEdges.length > 0
  ) {
    return {
      valid: false,
      reason:
        'This output already has a connected step. Replace it or use a branch-capable output.',
    }
  }

  if (
    (targetDefinition.acceptsMultipleInputs === false ||
      targetDefinition.maxIncomingConnections === 1) &&
    edges.some((edge) => edge.target === target.id)
  ) {
    return {
      valid: false,
      reason: `${targetDefinition.label} already has an incoming step. Focus the existing connection, replace it, or insert a step before this one.`,
    }
  }

  return { valid: true }
}

export function getWorkflowNodeRecommendations({
  source,
  plan,
  limit = 8,
}: {
  source: Node | undefined | null
  plan: PlanId
  limit?: number
}): WorkflowNodeRecommendation[] {
  const sourceDefinition = getNodeRegistryDefinitionFromFlowNode(
    source ?? undefined,
  )
  const sourceRole = getRole(sourceDefinition)
  const preferredIds = new Set([
    ...(sourceDefinition
      ? (COMMON_NEXT_STEPS[sourceDefinition.id] ??
        COMMON_NEXT_STEPS[sourceDefinition.type ?? ''] ??
        [])
      : []),
    ...(COMMON_NEXT_STEPS[sourceRole] ?? []),
  ])

  return workflowNodeRegistry
    .filter((definition) => isNodeAllowedForPlan(definition, plan))
    .filter((definition) => {
      if (!source) return true
      const syntheticTarget = {
        id: `candidate:${definition.id}`,
        type: getBuilderNodeTypeForDefinition(definition),
        data: { __registryNodeId: definition.id },
        position: { x: 0, y: 0 },
      } satisfies Node
      return validateWorkflowConnection({
        source,
        target: syntheticTarget,
      }).valid
    })
    .map((definition) => {
      const role = getRole(definition)
      let score = 20
      if (preferredIds.has(definition.id)) score += 60
      if (role === 'logic') score += sourceRole === 'trigger' ? 18 : 8
      if (role === 'action') score += 12
      if (definition.id === 'crm.trigger') score -= 100
      return {
        id: definition.id,
        type: getBuilderNodeTypeForDefinition(definition),
        label: definition.label,
        description: definition.description,
        definition,
        score,
      }
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
}

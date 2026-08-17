import type { Edge, Node } from 'reactflow'

import { validateWorkflowConnection } from '@/lib/workflows/connectionRules'
import { validateWorkflowVariables } from '@/lib/workflows/dataMapping'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { analyzeWorkflowBranches } from '@/lib/workflows/workflowBranches'
import { analyzeWorkflowData } from '@/lib/workflows/workflowDataFlow'
import {
  type NodeValidationResult,
  validateWorkflowNodeConfig,
} from '@/lib/workflows/nodeValidation'
import { getNodeOutputVariables } from '@/lib/workflows/variableRegistry'
import type {
  WorkflowConnectionRole,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'

export type WorkflowHealthSeverity = 'error' | 'warning' | 'suggestion'
export type WorkflowHealthStatus =
  | 'healthy'
  | 'ready'
  | 'needs-review'
  | 'major-issues'
  | 'broken'

export type WorkflowHealthIssue = {
  id: string
  severity: WorkflowHealthSeverity
  title: string
  description: string
  nodeId?: string
  edgeId?: string
  field?: string
  code:
    | 'missing-trigger'
    | 'multiple-triggers'
    | 'missing-end-path'
    | 'invalid-connection'
    | 'missing-required-field'
    | 'broken-variable'
    | 'invalid-mapping'
    | 'disconnected-node'
    | 'orphan-node'
    | 'cycle'
    | 'dead-branch'
    | 'empty-branch'
    | 'duplicate-connection'
    | 'unreachable-node'
    | 'best-practice'
    | 'branch-structure'
}

export type WorkflowHealthSuggestion = WorkflowHealthIssue & {
  severity: 'suggestion'
}

export type WorkflowHealthOptimization = {
  id: string
  title: string
  description: string
  nodeId?: string
  code:
    | 'delay-recommended'
    | 'duplicate-node-kind'
    | 'unused-delay'
    | 'repeated-ai'
    | 'repeated-webhook'
    | 'branch-simplification'
}

export type WorkflowHealthNodeState = {
  nodeId: string
  label: string
  registryId: string
  role: WorkflowConnectionRole
  state: 'ready' | 'warning' | 'error' | 'disconnected'
  status: NodeValidationResult['status']
  messages: NodeValidationResult['messages']
  disconnected: boolean
  blocked: boolean
  reasons: string[]
}

export type WorkflowGraphAnalysis = {
  roots: string[]
  triggerNodeIds: string[]
  endNodeIds: string[]
  orphanNodeIds: string[]
  disconnectedNodeIds: string[]
  unreachableNodeIds: string[]
  cycleNodeIds: string[]
  deadEndNodeIds: string[]
  emptyBranchNodeIds: string[]
  duplicateConnectionIds: string[]
  connectedComponents: number
  branchCount: number
  longestPath: number
  hasCycle: boolean
}

export type WorkflowHealthScore = {
  value: number
  label: WorkflowHealthStatus
  confidence: number
}

export type PublishReadiness = {
  ready: boolean
  blockers: WorkflowHealthIssue[]
}

export type ExecutionReadiness = {
  ready: boolean
  estimatedRuntimeMs: number
  estimatedSteps: number
  variablesProduced: number
  variablesConsumed: number
  branchCount: number
  longestPath: number
  nodeCount: number
  connectionCount: number
  connectedComponents: number
}

export type WorkflowHealth = {
  score: WorkflowHealthScore
  errors: WorkflowHealthIssue[]
  warnings: WorkflowHealthIssue[]
  suggestions: WorkflowHealthSuggestion[]
  optimizations: WorkflowHealthOptimization[]
  readyNodes: WorkflowHealthNodeState[]
  blockedNodes: WorkflowHealthNodeState[]
  nodeResults: Record<string, WorkflowHealthNodeState>
  graph: WorkflowGraphAnalysis
  publishReadiness: PublishReadiness
  executionReadiness: ExecutionReadiness
  futureRecommendations: WorkflowHealthSuggestion[]
}

export function createWorkflowHealthFingerprint({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}) {
  const nodeParts = nodes
    .map((node) => {
      const data = node.data as Record<string, unknown> | undefined
      return JSON.stringify({
        id: node.id,
        type: registryIdForNode(node),
        data,
      })
    })
    .sort()
  const edgeParts = edges
    .map((edge) =>
      JSON.stringify({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        data: edge.data ?? null,
      }),
    )
    .sort()
  return [...nodeParts, ...edgeParts].join('|')
}

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function definitionForNode(node: Node) {
  return getWorkflowNodeDefinition(registryIdForNode(node))
}

function roleForDefinition(
  definition: WorkflowNodeDefinition | undefined,
): WorkflowConnectionRole {
  return (
    definition?.connectionRole ??
    (definition?.canBeTrigger ? 'trigger' : 'action')
  )
}

function requiresOutgoingConnection(
  definition: WorkflowNodeDefinition | undefined,
) {
  return Boolean(definition?.requiresOutgoingConnection)
}

function requiredBranchHandles(definition: WorkflowNodeDefinition | undefined) {
  return definition?.requiredBranchHandles ?? []
}

function isTrigger(node: Node) {
  return roleForDefinition(definitionForNode(node)) === 'trigger'
}

function isActionLike(node: Node) {
  const definition = definitionForNode(node)
  const role = roleForDefinition(definition)
  return (
    role === 'action' ||
    role === 'utility' ||
    Boolean(definition?.terminalCapable)
  )
}

function nodeLabel(node?: Node) {
  if (!node) return 'Workflow'
  const data = node.data as { label?: unknown } | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  return definitionForNode(node)?.label ?? node.type ?? node.id
}

function issue({
  severity,
  code,
  title,
  description,
  nodeId,
  edgeId,
  field,
}: Omit<WorkflowHealthIssue, 'id'>): WorkflowHealthIssue {
  const stableContext = [
    code,
    nodeId ?? '',
    field ?? '',
    edgeId ?? '',
    title,
  ].join(':')
  return {
    id: stableContext,
    severity,
    code,
    title,
    description,
    nodeId,
    edgeId,
    field,
  }
}

function suggestion(
  code: WorkflowHealthIssue['code'],
  title: string,
  description: string,
  nodeId?: string,
): WorkflowHealthSuggestion {
  return issue({
    severity: 'suggestion',
    code,
    title,
    description,
    nodeId,
  }) as WorkflowHealthSuggestion
}

function incomingMap(edges: Edge[]) {
  const incoming = new Map<string, Edge[]>()
  for (const edge of edges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge])
  }
  return incoming
}

function outgoingMap(edges: Edge[]) {
  const outgoing = new Map<string, Edge[]>()
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge])
  }
  return outgoing
}

function reachableFrom(starts: string[], edges: Edge[]) {
  const visited = new Set<string>()
  const outgoing = outgoingMap(edges)
  const queue = [...starts]
  while (queue.length) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)
    for (const edge of outgoing.get(current) ?? []) {
      if (!visited.has(edge.target)) queue.push(edge.target)
    }
  }
  return visited
}

function findCycleNodes(nodes: Node[], edges: Edge[]) {
  const outgoing = outgoingMap(edges)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cycleNodes = new Set<string>()

  const visit = (nodeId: string, path: string[]) => {
    if (visiting.has(nodeId)) {
      const start = path.indexOf(nodeId)
      for (const id of path.slice(Math.max(0, start))) cycleNodes.add(id)
      return
    }
    if (visited.has(nodeId)) return
    visiting.add(nodeId)
    for (const edge of outgoing.get(nodeId) ?? []) {
      visit(edge.target, [...path, edge.target])
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  for (const node of nodes) visit(node.id, [node.id])
  return [...cycleNodes]
}

function connectedComponents(nodes: Node[], edges: Edge[]) {
  const adjacency = new Map<string, Set<string>>()
  for (const node of nodes) adjacency.set(node.id, new Set())
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }
  const visited = new Set<string>()
  let count = 0
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    count += 1
    const queue = [node.id]
    while (queue.length) {
      const current = queue.shift()
      if (!current || visited.has(current)) continue
      visited.add(current)
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next)
      }
    }
  }
  return count
}

function longestPathFromTriggers(triggerIds: string[], edges: Edge[]) {
  const outgoing = outgoingMap(edges)
  const memo = new Map<string, number>()
  const visiting = new Set<string>()
  const walk = (nodeId: string): number => {
    if (visiting.has(nodeId)) return 0
    if (memo.has(nodeId)) return memo.get(nodeId) ?? 0
    visiting.add(nodeId)
    const length = Math.max(
      1,
      ...(outgoing.get(nodeId) ?? []).map((edge) => 1 + walk(edge.target)),
    )
    visiting.delete(nodeId)
    memo.set(nodeId, length)
    return length
  }
  return triggerIds.length ? Math.max(...triggerIds.map(walk)) : 0
}

export function analyzeWorkflowGraph({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): WorkflowGraphAnalysis {
  const incoming = incomingMap(edges)
  const outgoing = outgoingMap(edges)
  const triggerNodeIds = nodes.filter(isTrigger).map((node) => node.id)
  const roots = nodes
    .filter((node) => (incoming.get(node.id) ?? []).length === 0)
    .map((node) => node.id)
  const reachable = reachableFrom(triggerNodeIds, edges)
  const cycleNodeIds = findCycleNodes(nodes, edges)
  const duplicateConnectionIds: string[] = []
  const seenConnections = new Set<string>()

  for (const edge of edges) {
    const key = `${edge.source}:${edge.target}:${edge.sourceHandle ?? ''}:${edge.targetHandle ?? ''}`
    if (seenConnections.has(key)) duplicateConnectionIds.push(edge.id)
    seenConnections.add(key)
  }

  return {
    roots,
    triggerNodeIds,
    endNodeIds: nodes
      .filter(
        (node) =>
          isActionLike(node) && (outgoing.get(node.id) ?? []).length === 0,
      )
      .map((node) => node.id),
    orphanNodeIds: nodes
      .filter(
        (node) =>
          nodes.length > 1 &&
          (incoming.get(node.id) ?? []).length === 0 &&
          (outgoing.get(node.id) ?? []).length === 0,
      )
      .map((node) => node.id),
    disconnectedNodeIds: nodes
      .filter(
        (node) =>
          !isTrigger(node) &&
          nodes.length > 1 &&
          (incoming.get(node.id) ?? []).length === 0,
      )
      .map((node) => node.id),
    unreachableNodeIds: nodes
      .filter((node) => triggerNodeIds.length > 0 && !reachable.has(node.id))
      .map((node) => node.id),
    cycleNodeIds,
    deadEndNodeIds: nodes
      .filter((node) => {
        const definition = definitionForNode(node)
        return (
          requiresOutgoingConnection(definition) &&
          (outgoing.get(node.id) ?? []).length === 0
        )
      })
      .map((node) => node.id),
    emptyBranchNodeIds: nodes
      .filter((node) => {
        const definition = definitionForNode(node)
        const requiredHandles = requiredBranchHandles(definition)
        if (!requiredHandles.length) return false
        const connectedHandles = new Set(
          (outgoing.get(node.id) ?? [])
            .map((edge) => edge.sourceHandle)
            .filter((handle): handle is string => Boolean(handle)),
        )
        return requiredHandles.some((handle) => !connectedHandles.has(handle))
      })
      .map((node) => node.id),
    duplicateConnectionIds,
    connectedComponents: connectedComponents(nodes, edges),
    branchCount: nodes.filter(
      (node) => (outgoing.get(node.id) ?? []).length > 1,
    ).length,
    longestPath: longestPathFromTriggers(triggerNodeIds, edges),
    hasCycle: cycleNodeIds.length > 0,
  }
}

function healthLabel(score: number): WorkflowHealthStatus {
  if (score >= 98) return 'healthy'
  if (score >= 90) return 'ready'
  if (score >= 75) return 'needs-review'
  if (score >= 50) return 'major-issues'
  return 'broken'
}

function calculateScore({
  errors,
  warnings,
  suggestions,
  optimizations,
  blocked,
}: {
  errors: number
  warnings: number
  suggestions: number
  optimizations: number
  blocked: number
}): WorkflowHealthScore {
  const value = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          errors * 18 -
          warnings * 6 -
          blocked * 8 -
          suggestions * 2 -
          optimizations,
      ),
    ),
  )
  return {
    value,
    label: healthLabel(value),
    confidence: Math.max(
      40,
      Math.min(100, Math.round(100 - errors * 5 - warnings * 2)),
    ),
  }
}

function hasFieldMatch(
  definition: WorkflowNodeDefinition | undefined,
  pattern: RegExp,
) {
  return (definition?.configFields ?? []).some((field) =>
    pattern.test(
      `${field.id} ${field.key ?? ''} ${field.label} ${field.helpText ?? ''}`.toLowerCase(),
    ),
  )
}

function configText(node: Node) {
  return JSON.stringify(node.data ?? {}).toLowerCase()
}

function fieldKey(field: { id: string; key?: string }) {
  return field.key ?? field.id
}

function hasPersonalizedMixedTextField(
  node: Node,
  definition: WorkflowNodeDefinition | undefined,
) {
  const config = (node.data ?? {}) as Record<string, unknown>
  const mixedTextFields = (definition?.configFields ?? []).filter(
    (field) => field.allowsMixedText,
  )
  if (!mixedTextFields.length) return configText(node).includes('{{')
  return mixedTextFields.some((field) => {
    const value = config[fieldKey(field)]
    return typeof value === 'string' && value.includes('{{')
  })
}

function deriveBestPracticeSuggestions(
  nodes: Node[],
  edges: Edge[],
  graph: WorkflowGraphAnalysis,
) {
  const outgoing = outgoingMap(edges)
  const suggestions: WorkflowHealthSuggestion[] = []
  const definitions = new Map(
    nodes.map((node) => [node.id, definitionForNode(node)]),
  )

  for (const node of nodes) {
    const definition = definitions.get(node.id)
    const role = roleForDefinition(definition)
    const text =
      `${definition?.label ?? ''} ${definition?.description ?? ''} ${definition?.category ?? ''}`.toLowerCase()
    const nextDefinitions = (outgoing.get(node.id) ?? [])
      .map((edge) => definitions.get(edge.target))
      .filter(Boolean)

    if (role === 'logic' && (outgoing.get(node.id) ?? []).length < 2) {
      suggestions.push(
        suggestion(
          'empty-branch',
          'Add a fallback branch',
          `${nodeLabel(node)} has fewer than two outgoing paths.`,
          node.id,
        ),
      )
    }

    if (
      definition?.category === 'Communication' &&
      text.includes('sms') &&
      !nextDefinitions.some(
        (item) =>
          item?.connectionRole === 'utility' || item?.category === 'Utilities',
      )
    ) {
      suggestions.push(
        suggestion(
          'best-practice',
          'Consider a short delay',
          `${nodeLabel(node)} may work better with a delay before the next follow-up.`,
          node.id,
        ),
      )
    }

    if (
      definition?.category === 'Communication' &&
      text.includes('email') &&
      !hasPersonalizedMixedTextField(node, definition)
    ) {
      suggestions.push(
        suggestion(
          'best-practice',
          'Add personalization',
          `${nodeLabel(node)} does not appear to use workflow data in its message.`,
          node.id,
        ),
      )
    }

    if (
      definition?.category === 'Integrations' &&
      hasFieldMatch(definition, /\bretry|timeout\b/) &&
      !configText(node).includes('retry')
    ) {
      suggestions.push(
        suggestion(
          'best-practice',
          'Add retry handling',
          `${nodeLabel(node)} should define retry or timeout behavior before production use.`,
          node.id,
        ),
      )
    }

    if (
      definition?.category === 'AI' &&
      !hasFieldMatch(definition, /\bfallback|confidence\b/)
    ) {
      suggestions.push(
        suggestion(
          'best-practice',
          'Add AI fallback handling',
          `${nodeLabel(node)} should have a fallback path or confidence threshold.`,
          node.id,
        ),
      )
    }
  }

  if (graph.connectedComponents > 1) {
    suggestions.push(
      suggestion(
        'best-practice',
        'Connect workflow components',
        'This workflow has separate groups that may not execute together.',
      ),
    )
  }

  const dataFlow = analyzeWorkflowData({ nodes, edges })
  const unusedBusinessVariable = dataFlow.unusedBusinessVariables[0]
  if (unusedBusinessVariable?.sourceNodeId && nodes.length > 1) {
    suggestions.push(
      suggestion(
        'best-practice',
        'Unused workflow data',
        `${unusedBusinessVariable.sourceNodeLabel ?? 'A workflow step'} creates ${unusedBusinessVariable.label}, but no later step uses it yet.`,
        unusedBusinessVariable.sourceNodeId,
      ),
    )
  }

  return suggestions
}

function deriveOptimizations(nodes: Node[], edges: Edge[]) {
  const outgoing = outgoingMap(edges)
  const optimizations: WorkflowHealthOptimization[] = []
  const signatureCounts = new Map<string, Node[]>()

  for (const node of nodes) {
    const definition = definitionForNode(node)
    const signature = `${definition?.category ?? 'unknown'}:${definition?.connectionRole ?? definition?.type ?? node.type}:${JSON.stringify(node.data ?? {})}`
    signatureCounts.set(signature, [
      ...(signatureCounts.get(signature) ?? []),
      node,
    ])

    if (
      (definition?.connectionRole === 'utility' ||
        definition?.category === 'Utilities') &&
      (incomingMap(edges).get(node.id) ?? []).length === 0 &&
      (outgoing.get(node.id) ?? []).length === 0
    ) {
      optimizations.push({
        id: `optimization:unused-delay:${node.id}`,
        code: 'unused-delay',
        title: 'Unused utility step',
        description: `${nodeLabel(node)} is not connected to the workflow path.`,
        nodeId: node.id,
      })
    }
  }

  for (const [signature, matchingNodes] of signatureCounts) {
    if (matchingNodes.length < 2) continue
    const sample = matchingNodes[0]
    const definition = definitionForNode(sample)
    const code =
      definition?.category === 'AI'
        ? 'repeated-ai'
        : definition?.category === 'Integrations'
          ? 'repeated-webhook'
          : definition?.connectionRole === 'logic'
            ? 'branch-simplification'
            : 'duplicate-node-kind'
    optimizations.push({
      id: `optimization:${code}:${signature}`,
      code,
      title: 'Review repeated step setup',
      description: `${matchingNodes.length} ${definition?.label ?? 'steps'} appear to use the same setup.`,
      nodeId: sample.id,
    })
  }

  return optimizations
}

export function analyzeWorkflowHealth({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): WorkflowHealth {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const incoming = incomingMap(edges)
  const outgoing = outgoingMap(edges)
  const graph = analyzeWorkflowGraph({ nodes, edges })
  const errors: WorkflowHealthIssue[] = []
  const warnings: WorkflowHealthIssue[] = []
  const nodeResults: Record<string, WorkflowHealthNodeState> = {}

  const addIssue = (item: WorkflowHealthIssue) => {
    if ([...errors, ...warnings].some((existing) => existing.id === item.id))
      return
    if (item.severity === 'error') errors.push(item)
    else if (item.severity === 'warning') warnings.push(item)
  }

  for (const edge of edges) {
    const connection = validateWorkflowConnection({
      source: nodeMap.get(edge.source),
      target: nodeMap.get(edge.target),
      edges: edges.filter((candidate) => candidate.id !== edge.id),
    })
    if (!connection.valid) {
      addIssue(
        issue({
          severity: 'error',
          code: 'invalid-connection',
          title: 'Invalid connection',
          description: connection.reason ?? 'This connection is not valid.',
          nodeId: edge.target,
          edgeId: edge.id,
        }),
      )
    }
  }

  if (graph.triggerNodeIds.length === 0) {
    const firstNonTrigger = nodes.find((node) => !isTrigger(node))
    addIssue(
      issue({
        severity: 'error',
        code: 'missing-trigger',
        title: 'Missing Trigger',
        description: firstNonTrigger
          ? `Add a trigger node before ${nodeLabel(firstNonTrigger)}.`
          : 'Start with a trigger node.',
        nodeId: firstNonTrigger?.id,
      }),
    )
  }
  if (graph.triggerNodeIds.length > 1) {
    for (const triggerId of graph.triggerNodeIds.slice(1)) {
      addIssue(
        issue({
          severity: 'warning',
          code: 'multiple-triggers',
          title: 'Multiple triggers',
          description: 'This workflow has more than one starting trigger.',
          nodeId: triggerId,
        }),
      )
    }
  }
  if (nodes.length > 0 && graph.endNodeIds.length === 0) {
    addIssue(
      issue({
        severity: 'error',
        code: 'missing-end-path',
        title: 'Missing end path',
        description: 'Add an ending action to complete the workflow.',
      }),
    )
  }

  for (const nodeId of graph.cycleNodeIds) {
    addIssue(
      issue({
        severity: 'error',
        code: 'cycle',
        title: 'Circular dependency',
        description: `${nodeLabel(nodeMap.get(nodeId))} is part of a loop.`,
        nodeId,
      }),
    )
  }
  for (const nodeId of graph.disconnectedNodeIds) {
    addIssue(
      issue({
        severity: 'warning',
        code: 'disconnected-node',
        title: 'Disconnected from workflow',
        description: `${nodeLabel(nodeMap.get(nodeId))} is disconnected from the workflow.`,
        nodeId,
      }),
    )
  }
  for (const nodeId of graph.orphanNodeIds) {
    if (graph.disconnectedNodeIds.includes(nodeId)) continue
    addIssue(
      issue({
        severity: 'warning',
        code: 'orphan-node',
        title: 'Unused node',
        description: `${nodeLabel(nodeMap.get(nodeId))} is isolated and will not execute.`,
        nodeId,
      }),
    )
  }
  for (const nodeId of graph.unreachableNodeIds) {
    if (
      graph.disconnectedNodeIds.includes(nodeId) ||
      graph.orphanNodeIds.includes(nodeId)
    )
      continue
    addIssue(
      issue({
        severity: 'warning',
        code: 'unreachable-node',
        title: 'Unreachable node',
        description: `${nodeLabel(nodeMap.get(nodeId))} is not reachable from a trigger.`,
        nodeId,
      }),
    )
  }
  for (const nodeId of graph.deadEndNodeIds) {
    addIssue(
      issue({
        severity: 'warning',
        code: 'dead-branch',
        title: 'Dead branch',
        description: `${nodeLabel(nodeMap.get(nodeId))} does not continue to an action.`,
        nodeId,
      }),
    )
  }
  for (const nodeId of graph.emptyBranchNodeIds) {
    addIssue(
      issue({
        severity: 'warning',
        code: 'empty-branch',
        title: 'Incomplete branch',
        description: `${nodeLabel(nodeMap.get(nodeId))} has an unused branch path.`,
        nodeId,
      }),
    )
  }
  for (const edgeId of graph.duplicateConnectionIds) {
    addIssue(
      issue({
        severity: 'warning',
        code: 'duplicate-connection',
        title: 'Duplicate connection',
        description: 'Two connections point between the same steps.',
        edgeId,
      }),
    )
  }

  for (const node of nodes) {
    const definition = definitionForNode(node)
    const validation = validateWorkflowNodeConfig(
      registryIdForNode(node),
      (node.data ?? {}) as Record<string, unknown>,
    )
    const messages = [...validation.messages]
    for (const message of validation.messages) {
      addIssue(
        issue({
          severity: message.severity,
          code:
            message.severity === 'error'
              ? 'missing-required-field'
              : 'best-practice',
          title:
            message.severity === 'error'
              ? 'Missing required setup'
              : 'Setup warning',
          description: `${definition?.label ?? node.type}: ${message.message}`,
          nodeId: node.id,
          field: message.field,
        }),
      )
    }
    const disconnected =
      graph.disconnectedNodeIds.includes(node.id) ||
      graph.orphanNodeIds.includes(node.id)
    const blocked =
      validation.status === 'error' ||
      graph.cycleNodeIds.includes(node.id) ||
      graph.unreachableNodeIds.includes(node.id) ||
      disconnected
    nodeResults[node.id] = {
      nodeId: node.id,
      label: nodeLabel(node),
      registryId: registryIdForNode(node),
      role: roleForDefinition(definition),
      state:
        validation.status === 'error'
          ? 'error'
          : validation.status === 'warning'
            ? 'warning'
            : disconnected
              ? 'disconnected'
              : 'ready',
      status: validation.status,
      messages,
      disconnected,
      blocked,
      reasons: messages.map((message) => message.message),
    }
  }

  for (const variableIssue of validateWorkflowVariables({ nodes, edges })) {
    const item = issue({
      severity: variableIssue.severity,
      code:
        variableIssue.status === 'incompatible'
          ? 'invalid-mapping'
          : 'broken-variable',
      title:
        variableIssue.status === 'incompatible'
          ? 'Invalid mapping'
          : 'Broken variable',
      description: variableIssue.message,
      nodeId: variableIssue.nodeId,
      edgeId: variableIssue.edgeId,
      field: variableIssue.field,
    })
    addIssue(item)
    if (variableIssue.nodeId && nodeResults[variableIssue.nodeId]) {
      const result = nodeResults[variableIssue.nodeId]
      result.messages = [
        ...result.messages,
        {
          field: variableIssue.field,
          severity: variableIssue.severity,
          message: variableIssue.message,
        },
      ]
      result.reasons = [...result.reasons, variableIssue.message]
      if (variableIssue.severity === 'error') {
        result.state = 'error'
        result.status = 'error'
        result.blocked = true
      } else if (result.state === 'ready') {
        result.state = 'warning'
        result.status = 'warning'
      }
    }
  }

  const branchAnalysis = analyzeWorkflowBranches({ nodes, edges })
  for (const branchIssue of branchAnalysis.issues) {
    const item = issue({
      severity: branchIssue.severity,
      code:
        branchIssue.severity === 'suggestion'
          ? 'best-practice'
          : 'branch-structure',
      title:
        branchIssue.severity === 'error'
          ? 'Branch setup issue'
          : branchIssue.severity === 'warning'
            ? 'Branch needs review'
            : 'Branch suggestion',
      description: branchIssue.message,
      nodeId: branchIssue.nodeId,
    })
    addIssue({ ...item, id: branchIssue.id })
    if (branchIssue.nodeId && nodeResults[branchIssue.nodeId]) {
      const result = nodeResults[branchIssue.nodeId]
      result.messages = [
        ...result.messages,
        {
          severity:
            branchIssue.severity === 'suggestion'
              ? 'warning'
              : branchIssue.severity,
          message: branchIssue.message,
        },
      ]
      result.reasons = [...result.reasons, branchIssue.message]
      if (branchIssue.severity === 'error') {
        result.state = 'error'
        result.status = 'error'
        result.blocked = true
      } else if (result.state === 'ready') {
        result.state = 'warning'
        result.status = 'warning'
      }
    }
  }

  const suggestions = deriveBestPracticeSuggestions(nodes, edges, graph)
  const optimizations = deriveOptimizations(nodes, edges)
  const blockedNodes = Object.values(nodeResults).filter((item) => item.blocked)
  const readyNodes = Object.values(nodeResults).filter(
    (item) => item.state === 'ready',
  )
  const publishBlockers = errors.filter((item) =>
    [
      'missing-trigger',
      'missing-end-path',
      'invalid-connection',
      'missing-required-field',
      'broken-variable',
      'invalid-mapping',
      'cycle',
      'branch-structure',
    ].includes(item.code),
  )
  const outputVariables = nodes.flatMap(getNodeOutputVariables)
  const consumedVariableCount = validateWorkflowVariables({
    nodes,
    edges,
  }).length
  const score = calculateScore({
    errors: errors.length,
    warnings: warnings.length,
    suggestions: suggestions.length,
    optimizations: optimizations.length,
    blocked: blockedNodes.length,
  })

  return {
    score,
    errors,
    warnings,
    suggestions,
    optimizations,
    readyNodes,
    blockedNodes,
    nodeResults,
    graph,
    publishReadiness: {
      ready:
        publishBlockers.length === 0 &&
        nodes.length > 0 &&
        graph.triggerNodeIds.length > 0,
      blockers: publishBlockers,
    },
    executionReadiness: {
      ready:
        errors.length === 0 &&
        nodes.length > 0 &&
        graph.triggerNodeIds.length > 0,
      estimatedRuntimeMs: Math.max(0, graph.longestPath || nodes.length) * 280,
      estimatedSteps: graph.longestPath || nodes.length,
      variablesProduced: outputVariables.length,
      variablesConsumed: consumedVariableCount,
      branchCount: graph.branchCount,
      longestPath: graph.longestPath,
      nodeCount: nodes.length,
      connectionCount: edges.length,
      connectedComponents: graph.connectedComponents,
    },
    futureRecommendations: [
      suggestion(
        'best-practice',
        'Add execution logging',
        'Runtime logs and monitoring will be connected in a later phase.',
      ),
      suggestion(
        'best-practice',
        'Review production retry policy',
        'Production retry behavior will be finalized with the publish assistant.',
      ),
    ],
  }
}

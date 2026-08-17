import type { Edge, Node } from 'reactflow'

import type { BuilderValidationIssue } from '@/lib/workflows/builderValidation'
import { analyzeWorkflowBranches } from '@/lib/workflows/workflowBranches'
import {
  evaluateBranchPreviewInput,
  getBranchPreviewInputs,
} from '@/lib/workflows/branchPreviewInputs'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { validateWorkflowNodeConfig } from '@/lib/workflows/nodeValidation'
import {
  getWorkflowVariableDefinition,
  getNodeOutputVariables,
  workflowVariableRegistry,
} from '@/lib/workflows/variableRegistry'
import type {
  WorkflowExecution,
  WorkflowExecutionLog,
  WorkflowExecutionStep,
  WorkflowRunStatus,
} from '@/lib/workflows/types'
import {
  getWorkflowExecutionFingerprint,
  summarizeWorkflowValidation,
  type WorkflowValidationReport,
} from '@/lib/workflows/workflowValidator'

export type WorkflowExecutionMode = 'preview' | 'production'
export type WorkflowRuntimeNodeStatus =
  | 'waiting'
  | 'running'
  | 'completed'
  | 'warning'
  | 'failed'
  | 'skipped'

export type WorkflowExecutionGraph = {
  nodeOrder: string[]
  adjacency: Record<string, string[]>
  incoming: Record<string, string[]>
  triggerNodeIds: string[]
  orphanNodeIds: string[]
  loopNodeIds: string[]
  invalidBranchNodeIds: string[]
  disconnectedPathNodeIds: string[]
}

export type WorkflowRuntimeContext = {
  executionId: string
  workflowId: string
  workspaceId: string
  mode: WorkflowExecutionMode
  triggerData: Record<string, unknown>
  variables: Record<string, unknown>
  executionState: Record<string, WorkflowRuntimeNodeStatus>
  currentNodeId?: string
  completedNodes: string[]
  skippedNodes: string[]
  failedNodes: string[]
  outputs: Record<string, Record<string, unknown>>
  startedAt: string
}

export type WorkflowExecutionSummary = {
  workflow: string
  completed: number
  failed: number
  skipped: number
  executionTimeMs: number
  variablesCreated: number
  variablesUsed: number
  nodesExecuted: number
  warnings: number
  errors: number
  branchCount: number
  estimatedRuntimeMs: number
  selectedPaths?: number
  skippedPaths?: number
  fallbackPathsUsed?: number
}

export type WorkflowExecutionReport = WorkflowExecution & {
  mode: WorkflowExecutionMode
  graph: WorkflowExecutionGraph
  context: WorkflowRuntimeContext
  summary: WorkflowExecutionSummary
  replay: {
    timestamp: string
    workflowVersion: string
    executionGraph: WorkflowExecutionGraph
    variables: Record<string, unknown>
    logs: WorkflowExecutionLog[]
    outputs: Record<string, Record<string, unknown>>
  }
}

export type WorkflowExecutionLifecycleEvent = {
  nodeId?: string
  edgeId?: string
  status: WorkflowRuntimeNodeStatus
  context: WorkflowRuntimeContext
  step?: WorkflowExecutionStep
}

export type WorkflowExecutionControls = {
  shouldStop?: () => boolean
  waitIfPaused?: () => Promise<void>
  onLifecycle?: (event: WorkflowExecutionLifecycleEvent) => void
}

const PREVIEW_NODE_DELAY_MS = 900

function nowIso() {
  return new Date().toISOString()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function nodeLabel(node: Node) {
  const label = (node.data as { label?: unknown } | undefined)?.label
  if (typeof label === 'string' && label.trim()) return label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    'Node'
  )
}

const SIMPLE_VALUE_ALIASES: Record<string, string> = {
  email: 'client.email',
  'client email': 'client.email',
  'customer email': 'client.email',
  name: 'client.name',
  'client name': 'client.name',
  'customer name': 'client.name',
  phone: 'client.phone',
  'client phone': 'client.phone',
  'customer phone': 'client.phone',
}

const PREVIEW_VALUE_FALLBACKS: Record<string, unknown> = {
  'client.email': 'client@example.com',
  'lead.email': 'lead@example.com',
  'owner.email': 'owner@skillify.local',
  'workspace.email': 'workspace@skillify.local',
  'client.phone': '555-555-0100',
  'lead.phone': '555-555-0199',
  'contact.phone': '555-555-0111',
  'client.name': 'NorthStar Electric',
  'lead.name': 'NorthStar Electric',
  'contact.name': 'Jordan Lee',
  'client.id': 'client_123',
}

function previewValueForVariable(key: string, context: WorkflowRuntimeContext) {
  return (
    context.variables[key] ??
    getWorkflowVariableDefinition(key)?.previewValue ??
    PREVIEW_VALUE_FALLBACKS[key] ??
    `{{${key}}}`
  )
}

function resolvePreviewValue(
  value: unknown,
  context: WorkflowRuntimeContext,
): unknown {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    const aliasKey = SIMPLE_VALUE_ALIASES[normalized]
    if (aliasKey) return previewValueForVariable(aliasKey, context)
    return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) =>
      String(previewValueForVariable(key, context)),
    )
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolvePreviewValue(item, context))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolvePreviewValue(item, context),
      ]),
    )
  }
  return value
}

function makeLog(
  runId: string,
  nodeId: string | undefined,
  level: WorkflowExecutionLog['level'],
  message: string,
): WorkflowExecutionLog {
  return {
    id: `${runId}:log:${nodeId ?? 'workflow'}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    timestamp: nowIso(),
    level,
    message,
    nodeId,
  }
}

export function buildWorkflowExecutionGraph({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): WorkflowExecutionGraph {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const adjacency = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
    incoming.set(node.id, [])
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) ?? []),
      edge.target,
    ])
    incoming.set(edge.target, [
      ...(incoming.get(edge.target) ?? []),
      edge.source,
    ])
  }

  const triggerNodeIds = nodes
    .filter(
      (node) =>
        getWorkflowNodeDefinition(registryIdForNode(node))?.canBeTrigger,
    )
    .map((node) => node.id)
  const queue = nodes
    .filter((node) => (incoming.get(node.id) ?? []).length === 0)
    .map((node) => node.id)
  const indegree = new Map(
    nodes.map((node) => [node.id, (incoming.get(node.id) ?? []).length]),
  )
  const nodeOrder: string[] = []

  while (queue.length) {
    const nodeId = queue.shift()
    if (!nodeId) continue
    nodeOrder.push(nodeId)
    for (const targetId of adjacency.get(nodeId) ?? []) {
      const next = (indegree.get(targetId) ?? 0) - 1
      indegree.set(targetId, next)
      if (next === 0) queue.push(targetId)
    }
  }

  const ordered = new Set(nodeOrder)
  const loopNodeIds = nodes
    .filter((node) => !ordered.has(node.id))
    .map((node) => node.id)
  const resolvedOrder = [...nodeOrder, ...loopNodeIds]
  const reachable = new Set<string>()
  const reachQueue = triggerNodeIds.length
    ? [...triggerNodeIds]
    : resolvedOrder.slice(0, 1)
  while (reachQueue.length) {
    const nodeId = reachQueue.shift()
    if (!nodeId || reachable.has(nodeId)) continue
    reachable.add(nodeId)
    reachQueue.push(...(adjacency.get(nodeId) ?? []))
  }

  const orphanNodeIds = nodes
    .filter(
      (node) => !reachable.has(node.id) && !triggerNodeIds.includes(node.id),
    )
    .map((node) => node.id)
  const invalidBranchNodeIds = nodes
    .filter((node) => {
      const definition = getWorkflowNodeDefinition(registryIdForNode(node))
      return definition?.logic && (adjacency.get(node.id) ?? []).length === 0
    })
    .map((node) => node.id)
  const disconnectedPathNodeIds = nodes
    .filter((node) => {
      const definition = getWorkflowNodeDefinition(registryIdForNode(node))
      return (
        !definition?.canBeTrigger &&
        nodes.length > 1 &&
        (incoming.get(node.id) ?? []).length === 0
      )
    })
    .map((node) => node.id)

  return {
    nodeOrder: resolvedOrder,
    adjacency: Object.fromEntries(adjacency),
    incoming: Object.fromEntries(incoming),
    triggerNodeIds,
    orphanNodeIds,
    loopNodeIds,
    invalidBranchNodeIds,
    disconnectedPathNodeIds,
  }
}

function createOutputForNode(node: Node, context: WorkflowRuntimeContext) {
  const registryId = registryIdForNode(node)
  const config = (node.data ?? {}) as Record<string, unknown>
  if (registryId === 'send.email') {
    return {
      to: resolvePreviewValue(config.recipient, context),
      cc: resolvePreviewValue(config.cc, context),
      subject: resolvePreviewValue(config.subject, context),
      body: resolvePreviewValue(config.body, context),
      deliveryStatus: 'prepared',
      messageId: 'email_preview_001',
      timestamp: nowIso(),
    }
  }
  if (registryId === 'send.sms') {
    return {
      to: resolvePreviewValue(config.phone, context),
      message: resolvePreviewValue(config.message, context),
      deliveryStatus: 'prepared',
      messageId: 'sms_preview_001',
      timestamp: nowIso(),
    }
  }
  if (registryId === 'webhook.placeholder') {
    return {
      method: resolvePreviewValue(config.method ?? 'POST', context),
      url: resolvePreviewValue(config.url, context),
      payload: resolvePreviewValue(
        config.outputMode === 'Fields' ? config.fieldMappings : config.body,
        context,
      ),
      responseCode: 200,
      responseBody: { ok: true, preview: true },
      timestamp: nowIso(),
    }
  }
  const outputs = getNodeOutputVariables(node)
  if (!outputs.length) {
    return {
      result: `${nodeLabel(node)} preview result`,
      timestamp: nowIso(),
    }
  }
  return Object.fromEntries(
    outputs.map((output) => {
      const value =
        output.previewValue ??
        context.variables[output.key] ??
        `${output.label} preview`
      return [output.key, value]
    }),
  )
}

function createWorkflowPreflightReport({
  automationId,
  workspaceId,
  issues,
  graph,
  validationReport,
  workflowFingerprint,
}: {
  automationId: string
  workspaceId: string
  issues: BuilderValidationIssue[]
  graph: WorkflowExecutionGraph
  validationReport?: WorkflowValidationReport
  workflowFingerprint?: string
}): WorkflowExecutionReport {
  const startedAt = nowIso()
  const executionId = `preview-${automationId}-${Date.now()}`
  const context: WorkflowRuntimeContext = {
    executionId,
    workflowId: automationId,
    workspaceId,
    mode: 'preview',
    triggerData: {},
    variables: {},
    executionState: {},
    completedNodes: [],
    skippedNodes: [],
    failedNodes: [],
    outputs: {},
    startedAt,
  }
  const blockingIssues = issues.filter((issue) => issue.severity === 'error')
  const visibleIssues = blockingIssues.length
    ? blockingIssues
    : [
        {
          id: 'preview:workflow:cannot-preview',
          severity: 'error' as const,
          message: 'Cannot preview. Resolve blocking validation issues first.',
        },
      ]
  const steps = visibleIssues.map(
    (issue, index): WorkflowExecutionStep => ({
      id: `${executionId}:preflight:${index}`,
      runId: executionId,
      nodeId: issue.nodeId ?? 'workflow',
      nodeType: 'validation',
      label: issue.message,
      status: 'failed',
      startedAt,
      finishedAt: startedAt,
      error: issue.message,
      logs: [
        {
          ...makeLog(
            executionId,
            issue.nodeId ?? 'workflow',
            'error',
            issue.message,
          ),
          issueId: issue.id,
        },
      ],
      output: {},
    }),
  )
  const logs = steps.flatMap((step) => step.logs)
  const summary: WorkflowExecutionSummary = {
    workflow: automationId,
    completed: 0,
    failed: steps.length,
    skipped: 0,
    executionTimeMs: 0,
    variablesCreated: 0,
    variablesUsed: 0,
    nodesExecuted: 0,
    warnings: 0,
    errors: steps.length,
    branchCount: 0,
    estimatedRuntimeMs: 0,
  }
  return {
    id: executionId,
    workflowId: automationId,
    workspaceId,
    status: 'failed',
    triggerSource: 'Cannot preview',
    startedAt,
    finishedAt: startedAt,
    steps,
    logs,
    error: visibleIssues[0]?.message ?? 'Cannot preview.',
    mode: 'preview',
    runKind: 'preview',
    workflowFingerprint,
    graph,
    context,
    validation: validationReport
      ? summarizeWorkflowValidation(validationReport)
      : {
          status: 'blocked',
          readinessState: 'cannot-publish',
          readinessLabel: 'Cannot publish',
          errorCount: steps.length,
          warningCount: 0,
          infoCount: 0,
          issueIds: visibleIssues.map((issue) => issue.id),
          blockingIssueIds: visibleIssues.map((issue) => issue.id),
        },
    summary,
    replay: {
      timestamp: startedAt,
      workflowVersion: 'preview-local',
      executionGraph: graph,
      variables: context.variables,
      logs,
      outputs: context.outputs,
    },
  }
}

export async function executeWorkflowPreview({
  automationId,
  workspaceId,
  nodes,
  edges,
  preflightIssues = [],
  controls,
  previewDelayMs = PREVIEW_NODE_DELAY_MS,
  previewData,
  validationReport: providedValidationReport,
  workflowFingerprint: providedWorkflowFingerprint,
}: {
  automationId: string
  workspaceId: string
  nodes: Node[]
  edges: Edge[]
  preflightIssues?: BuilderValidationIssue[]
  controls?: WorkflowExecutionControls
  previewDelayMs?: number
  previewData?: Record<string, unknown>
  validationReport?: WorkflowValidationReport
  workflowFingerprint?: string
}): Promise<WorkflowExecutionReport> {
  const graph = buildWorkflowExecutionGraph({ nodes, edges })
  const validationReport = providedValidationReport
  const workflowFingerprint =
    providedWorkflowFingerprint ??
    validationReport?.fingerprint ??
    getWorkflowExecutionFingerprint({ nodes, edges })
  const branchAnalysis = analyzeWorkflowBranches({ nodes, edges, previewData })
  const branchPreviewInputs = getBranchPreviewInputs({
    nodes,
    edges,
    overrides: {},
  }).map((input) => ({
    ...input,
    currentValue: String(previewData?.[input.fieldKey] ?? input.currentValue),
    currentLabel: String(previewData?.[input.fieldKey] ?? input.currentLabel),
  }))
  const explicitBlockingIssues = preflightIssues.filter(
    (issue) => issue.severity === 'error',
  )
  if (
    explicitBlockingIssues.length ||
    validationReport?.readiness.canPreview === false
  ) {
    return createWorkflowPreflightReport({
      automationId,
      workspaceId,
      issues: explicitBlockingIssues.length
        ? explicitBlockingIssues
        : (validationReport?.errors.map(
            (issue): BuilderValidationIssue => ({
              id: issue.id,
              severity: 'error',
              message: issue.message,
              nodeId: issue.nodeId,
              field: issue.inspectorField,
            }),
          ) ?? []),
      graph,
      validationReport,
      workflowFingerprint,
    })
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const edgeMap = new Map(
    edges.map((edge) => [`${edge.source}:${edge.target}`, edge]),
  )
  const skippedPathNodeIds = new Set<string>()
  for (const branch of branchAnalysis.branchNodes) {
    for (const path of branch.paths) {
      if (!branch.skippedPathKeys.includes(path.pathKey)) continue
      for (const pathNodeId of path.reachableNodeIds) {
        if (path.rejoinNodeIds.includes(pathNodeId)) continue
        skippedPathNodeIds.add(pathNodeId)
      }
    }
  }
  const startedAt = nowIso()
  const startMs = Date.now()
  const executionId = `preview-${automationId}-${startMs}`
  const context: WorkflowRuntimeContext = {
    executionId,
    workflowId: automationId,
    workspaceId,
    mode: 'preview',
    triggerData: Object.fromEntries(
      workflowVariableRegistry.map((variable) => [
        variable.key,
        variable.previewValue,
      ]),
    ),
    variables: Object.fromEntries(
      workflowVariableRegistry.map((variable) => [
        variable.key,
        variable.previewValue,
      ]),
    ),
    executionState: Object.fromEntries(
      nodes.map((node) => [node.id, 'waiting' as const]),
    ),
    completedNodes: [],
    skippedNodes: [],
    failedNodes: [],
    outputs: {},
    startedAt,
  }
  const steps: WorkflowExecutionStep[] = []
  const logs: WorkflowExecutionLog[] = []
  let status: WorkflowRunStatus = 'succeeded'
  let error: string | undefined
  const variablesUsed = new Set<string>()

  const skipRemaining = (fromNodeId?: string) => {
    const startIndex = fromNodeId
      ? Math.max(0, graph.nodeOrder.indexOf(fromNodeId))
      : 0
    for (const skippedNodeId of graph.nodeOrder.slice(startIndex)) {
      if (
        context.completedNodes.includes(skippedNodeId) ||
        context.failedNodes.includes(skippedNodeId) ||
        context.skippedNodes.includes(skippedNodeId)
      ) {
        continue
      }
      const skippedNode = nodeMap.get(skippedNodeId)
      context.executionState[skippedNodeId] = 'skipped'
      context.skippedNodes.push(skippedNodeId)
      const skippedLog = makeLog(
        executionId,
        skippedNodeId,
        'warning',
        `${skippedNode ? nodeLabel(skippedNode) : skippedNodeId} skipped because preview was stopped.`,
      )
      logs.push(skippedLog)
      steps.push({
        id: `${executionId}:skipped:${skippedNodeId}`,
        runId: executionId,
        nodeId: skippedNodeId,
        nodeType: skippedNode?.type ?? 'unknown',
        label: skippedNode ? nodeLabel(skippedNode) : skippedNodeId,
        status: 'skipped',
        startedAt: nowIso(),
        finishedAt: nowIso(),
        logs: [skippedLog],
        output: {},
      })
      controls?.onLifecycle?.({
        nodeId: skippedNodeId,
        status: 'skipped',
        context,
      })
    }
  }

  for (const nodeId of graph.nodeOrder) {
    if (skippedPathNodeIds.has(nodeId)) {
      const skippedNode = nodeMap.get(nodeId)
      context.executionState[nodeId] = 'skipped'
      context.skippedNodes.push(nodeId)
      const pathContext = branchAnalysis.pathByNodeId[nodeId]
      const skippedLog = makeLog(
        executionId,
        nodeId,
        'info',
        pathContext
          ? `${skippedNode ? nodeLabel(skippedNode) : nodeId} skipped because ${pathContext.pathLabel} was not selected.`
          : `${skippedNode ? nodeLabel(skippedNode) : nodeId} skipped by branch selection.`,
      )
      logs.push(skippedLog)
      steps.push({
        id: `${executionId}:branch-skipped:${nodeId}`,
        runId: executionId,
        nodeId,
        nodeType: skippedNode?.type ?? 'unknown',
        label: skippedNode ? nodeLabel(skippedNode) : nodeId,
        status: 'skipped',
        startedAt: nowIso(),
        finishedAt: nowIso(),
        logs: [skippedLog],
        output: {
          __branchPath: pathContext?.pathKey,
          __branchPathLabel: pathContext?.pathLabel,
          __branchStatus: 'skipped',
        },
      })
      controls?.onLifecycle?.({ nodeId, status: 'skipped', context })
      continue
    }
    if (controls?.shouldStop?.()) {
      status = 'skipped'
      logs.push(makeLog(executionId, nodeId, 'warning', 'Preview run stopped.'))
      skipRemaining(nodeId)
      break
    }
    await controls?.waitIfPaused?.()
    const node = nodeMap.get(nodeId)
    if (!node) continue
    const definition = getWorkflowNodeDefinition(registryIdForNode(node))
    const validation = validateWorkflowNodeConfig(
      registryIdForNode(node),
      (node.data ?? {}) as Record<string, unknown>,
    )
    const incoming = graph.incoming[nodeId] ?? []
    const incomingEdges = incoming
      .map((sourceId) => edgeMap.get(`${sourceId}:${nodeId}`))
      .filter(Boolean) as Edge[]
    const stepStarted = nowIso()
    const stepStartMs = Date.now()
    context.currentNodeId = nodeId
    context.executionState[nodeId] = 'running'
    for (const edge of incomingEdges) {
      controls?.onLifecycle?.({
        edgeId: edge.id,
        nodeId,
        status: 'running',
        context,
      })
    }
    controls?.onLifecycle?.({ nodeId, status: 'running', context })
    await sleep(previewDelayMs)
    await controls?.waitIfPaused?.()
    if (controls?.shouldStop?.()) {
      status = 'skipped'
      logs.push(makeLog(executionId, nodeId, 'warning', 'Preview run stopped.'))
      skipRemaining(nodeId)
      break
    }

    const stepLogs = [
      makeLog(executionId, nodeId, 'info', `${nodeLabel(node)} started.`),
    ]
    const branchNode = branchAnalysis.branchNodes.find(
      (branch) => branch.nodeId === nodeId,
    )
    if (branchNode) {
      const branchInput = branchPreviewInputs.find(
        (input) => input.nodeId === nodeId,
      )
      const branchEvaluation = branchInput
        ? evaluateBranchPreviewInput(branchInput)
        : null
      const selectedLabels = branchNode.paths
        .filter((path) => branchNode.selectedPathKeys.includes(path.pathKey))
        .map((path) => path.pathLabel)
      const skippedLabels = branchNode.paths
        .filter((path) => branchNode.skippedPathKeys.includes(path.pathKey))
        .map((path) => path.pathLabel)
      stepLogs.push(
        makeLog(
          executionId,
          nodeId,
          'info',
          selectedLabels.length
            ? `Selected path${selectedLabels.length === 1 ? '' : 's'}: ${selectedLabels.join(', ')}.`
            : 'No branch path matched.',
        ),
      )
      if (skippedLabels.length) {
        stepLogs.push(
          makeLog(
            executionId,
            nodeId,
            'info',
            `Skipped path${skippedLabels.length === 1 ? '' : 's'}: ${skippedLabels.join(', ')}.`,
          ),
        )
      }
      if (branchEvaluation) {
        stepLogs.push(
          makeLog(executionId, nodeId, 'info', branchEvaluation.explanation),
        )
      }
    }
    if (validation.status === 'error') {
      const message =
        validation.messages.find((item) => item.severity === 'error')
          ?.message ?? `${nodeLabel(node)} failed validation.`
      context.executionState[nodeId] = 'failed'
      context.failedNodes.push(nodeId)
      error = `${nodeLabel(node)}: ${message}`
      status = 'failed'
      stepLogs.push(makeLog(executionId, nodeId, 'error', message))
      const step: WorkflowExecutionStep = {
        id: `${executionId}:step:${nodeId}`,
        runId: executionId,
        nodeId,
        nodeType: node.type ?? 'unknown',
        label: nodeLabel(node),
        status: 'failed',
        startedAt: stepStarted,
        finishedAt: nowIso(),
        logs: stepLogs,
        error: message,
        output: {},
      }
      steps.push(step)
      logs.push(...stepLogs)
      controls?.onLifecycle?.({ nodeId, status: 'failed', context, step })
      break
    }

    for (const value of Object.values(
      (node.data ?? {}) as Record<string, unknown>,
    )) {
      if (typeof value === 'string') {
        for (const match of value.matchAll(
          /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
        )) {
          variablesUsed.add(match[1])
        }
      }
    }
    const output = createOutputForNode(node, context)
    context.outputs[nodeId] = output
    Object.assign(context.variables, output)
    const duration = Date.now() - stepStartMs
    const warningMessages = validation.messages.filter(
      (item) => item.severity === 'warning',
    )
    for (const warning of warningMessages) {
      stepLogs.push(makeLog(executionId, nodeId, 'warning', warning.message))
    }
    const previewOutput = output as Record<string, unknown>
    if (typeof previewOutput.to === 'string' && previewOutput.to.trim()) {
      stepLogs.push(
        makeLog(executionId, nodeId, 'info', `To: ${previewOutput.to}`),
      )
    }
    stepLogs.push(
      makeLog(
        executionId,
        nodeId,
        'info',
        `Completed in ${duration}ms. Produced ${Object.keys(output).length} variable${Object.keys(output).length === 1 ? '' : 's'}.`,
      ),
    )
    context.executionState[nodeId] = warningMessages.length
      ? 'warning'
      : 'completed'
    context.completedNodes.push(nodeId)
    const step: WorkflowExecutionStep = {
      id: `${executionId}:step:${nodeId}`,
      runId: executionId,
      nodeId,
      nodeType: definition?.id ?? node.type ?? 'unknown',
      label: nodeLabel(node),
      status: 'succeeded',
      startedAt: stepStarted,
      finishedAt: nowIso(),
      logs: stepLogs,
      output: {
        ...output,
        __durationMs: duration,
        __variablesProduced: Object.keys(output),
        __warnings: warningMessages.map((item) => item.message),
        ...(branchNode
          ? {
              __branchMode: branchNode.mode,
              __branchExplanation: branchPreviewInputs.find(
                (input) => input.nodeId === nodeId,
              )
                ? evaluateBranchPreviewInput(
                    branchPreviewInputs.find(
                      (input) => input.nodeId === nodeId,
                    )!,
                  ).explanation
                : undefined,
              __branchPaths: branchNode.paths.map((path) => ({
                pathKey: path.pathKey,
                pathLabel: path.pathLabel,
                conditionSummary: path.conditionSummary,
                status: branchNode.selectedPathKeys.includes(path.pathKey)
                  ? 'selected'
                  : branchNode.skippedPathKeys.includes(path.pathKey)
                    ? 'skipped'
                    : path.connectedNodeIds.length
                      ? 'not-selected'
                      : 'not-connected',
                connectedStepId: path.connectedNodeIds[0],
                producedVariables: path.producedVariables.map(
                  (variable) => variable.label,
                ),
              })),
            }
          : {}),
      },
    }
    steps.push(step)
    logs.push(...stepLogs)
    controls?.onLifecycle?.({
      nodeId,
      status: warningMessages.length ? 'warning' : 'completed',
      context,
      step,
    })
    await sleep(previewDelayMs)
  }

  const finishedAt = nowIso()
  const executionTimeMs = Date.now() - startMs
  const summary: WorkflowExecutionSummary = {
    workflow: automationId,
    completed: context.completedNodes.length,
    failed: context.failedNodes.length,
    skipped: context.skippedNodes.length,
    executionTimeMs,
    variablesCreated: Object.keys(context.variables).length,
    variablesUsed: variablesUsed.size,
    nodesExecuted: steps.filter((step) => step.nodeId !== 'workflow').length,
    warnings: logs.filter((log) => log.level === 'warning').length,
    errors: logs.filter((log) => log.level === 'error').length,
    branchCount: Object.values(graph.adjacency).filter(
      (targets) => targets.length > 1,
    ).length,
    estimatedRuntimeMs: graph.nodeOrder.length * previewDelayMs,
    selectedPaths: branchAnalysis.branchNodes.reduce(
      (total, branch) => total + branch.selectedPathKeys.length,
      0,
    ),
    skippedPaths: branchAnalysis.branchNodes.reduce(
      (total, branch) => total + branch.skippedPathKeys.length,
      0,
    ),
    fallbackPathsUsed: branchAnalysis.branchNodes.reduce(
      (total, branch) =>
        total +
        branch.paths.filter(
          (path) =>
            path.isFallback && branch.selectedPathKeys.includes(path.pathKey),
        ).length,
      0,
    ),
  }
  logs.push(
    makeLog(
      executionId,
      'workflow',
      status === 'failed' ? 'error' : 'info',
      status === 'failed'
        ? `Preview failed: ${error}`
        : `Preview completed. ${summary.nodesExecuted} node${summary.nodesExecuted === 1 ? '' : 's'} executed.`,
    ),
  )

  return {
    id: executionId,
    workflowId: automationId,
    workspaceId,
    status,
    triggerSource: graph.triggerNodeIds.length
      ? 'Preview trigger fired'
      : 'preview',
    startedAt,
    finishedAt,
    steps,
    logs,
    error,
    mode: 'preview',
    runKind: 'preview',
    workflowFingerprint,
    graph,
    context,
    validation: validationReport
      ? summarizeWorkflowValidation(validationReport)
      : undefined,
    summary,
    replay: {
      timestamp: finishedAt,
      workflowVersion: 'preview-local',
      executionGraph: graph,
      variables: context.variables,
      logs,
      outputs: context.outputs,
    },
  }
}

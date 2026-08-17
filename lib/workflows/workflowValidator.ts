import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import {
  analyzeWorkflowHealth,
  type WorkflowHealth,
  type WorkflowHealthIssue,
  type WorkflowHealthOptimization,
} from '@/lib/workflows/workflowHealth'
import type { WorkflowNodeAvailabilityState } from '@/lib/workflows/types'

export type WorkflowValidationSeverity = 'error' | 'warning' | 'info'
export type WorkflowValidationContext =
  | 'preview'
  | 'test'
  | 'publish'
  | 'execution'
export type PreviewFreshness = 'none' | 'current' | 'out_of_date'
export type WorkflowReadinessState =
  | 'ready'
  | 'ready-with-warnings'
  | 'needs-attention'
  | 'cannot-publish'

export type WorkflowValidationIssueCode =
  | WorkflowHealthIssue['code']
  | 'unknown-node'
  | 'duplicate-node-id'
  | 'deprecated-node'
  | 'node-requires-authentication'
  | 'node-requires-configuration'
  | 'node-coming-soon'
  | 'node-unavailable-for-workspace'
  | 'node-unavailable-for-plan'
  | 'invalid-url'
  | 'large-workflow'
  | 'complex-branching'
  | 'deep-workflow'
  | 'runtime-readiness'

export type WorkflowExecutionValidationIssue = {
  id: string
  severity: WorkflowValidationSeverity
  code: WorkflowValidationIssueCode
  nodeId?: string
  nodeTitle?: string
  edgeId?: string
  message: string
  suggestedResolution: string
  inspectorField?: string
  source: 'graph' | 'node' | 'registry' | 'data-flow' | 'branch' | 'runtime'
}

export type WorkflowReadinessEvaluation = {
  state: WorkflowReadinessState
  label: 'Ready' | 'Ready with warnings' | 'Needs attention' | 'Cannot publish'
  canPreview: boolean
  canTest: boolean
  canPublish: boolean
  canExecute: boolean
  requiresWarningConfirmation: boolean
  blockingIssueIds: string[]
  errorCount: number
  warningCount: number
  infoCount: number
}

export type WorkflowValidationReport = {
  id: string
  context: WorkflowValidationContext
  fingerprint: string
  generatedAt: string
  issues: WorkflowExecutionValidationIssue[]
  errors: WorkflowExecutionValidationIssue[]
  warnings: WorkflowExecutionValidationIssue[]
  info: WorkflowExecutionValidationIssue[]
  readiness: WorkflowReadinessEvaluation
  health: WorkflowHealth
}

export type WorkflowExecutionValidationSnapshot = {
  status: 'passed' | 'passed-with-warnings' | 'blocked'
  readinessState: WorkflowReadinessState
  readinessLabel: WorkflowReadinessEvaluation['label']
  errorCount: number
  warningCount: number
  infoCount: number
  issueIds: string[]
  blockingIssueIds: string[]
}

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function normalizeExecutionData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeExecutionData)
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !key.startsWith('__'))
    .map(([key, child]) => [key, normalizeExecutionData(child)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(entries)
}

export function getWorkflowExecutionFingerprint({
  nodes,
  edges,
  previewInputFingerprint,
}: {
  nodes: Node[]
  edges: Edge[]
  previewInputFingerprint?: string
}) {
  const nodeParts = nodes
    .map((node) =>
      JSON.stringify({
        id: node.id,
        type: node.type ?? null,
        registryId: registryIdForNode(node),
        data: normalizeExecutionData(node.data ?? {}),
      }),
    )
    .sort()
  const edgeParts = edges
    .map((edge) =>
      JSON.stringify({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        data: normalizeExecutionData(edge.data ?? null),
      }),
    )
    .sort()
  return [...nodeParts, ...edgeParts, previewInputFingerprint ?? ''].join('|')
}

export function getPreviewFreshness({
  previewFingerprint,
  currentFingerprint,
}: {
  previewFingerprint?: string | null
  currentFingerprint: string
}): PreviewFreshness {
  if (!previewFingerprint) return 'none'
  return previewFingerprint === currentFingerprint ? 'current' : 'out_of_date'
}

function nodeTitle(node?: Node) {
  if (!node) return undefined
  const data = node.data as { label?: unknown } | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    node.id
  )
}

function stableIssueId(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(':')
}

function sourceForHealthIssue(
  issue: WorkflowHealthIssue,
): WorkflowExecutionValidationIssue['source'] {
  if (issue.code === 'broken-variable' || issue.code === 'invalid-mapping')
    return 'data-flow'
  if (
    issue.code === 'branch-structure' ||
    issue.code === 'empty-branch' ||
    issue.code === 'dead-branch'
  )
    return 'branch'
  if (issue.code === 'missing-required-field') return 'node'
  return 'graph'
}

function suggestionForCode(
  code: WorkflowValidationIssueCode,
  node?: Node,
  field?: string,
) {
  const definition = node
    ? getWorkflowNodeDefinition(registryIdForNode(node))
    : undefined
  const fieldLabel = field
    ? definition?.configFields.find(
        (item) => item.id === field || item.key === field,
      )?.label
    : undefined
  switch (code) {
    case 'missing-trigger':
      return 'Add one trigger node so Skillify knows when the workflow should start.'
    case 'multiple-triggers':
      return 'Keep one trigger for this workflow, or confirm the multi-trigger behavior before publishing.'
    case 'missing-end-path':
      return 'Connect the workflow to a final action or terminal step.'
    case 'invalid-connection':
      return 'Reconnect these steps using compatible handles and node roles.'
    case 'missing-required-field':
      return fieldLabel
        ? `Open Setup and complete ${fieldLabel}.`
        : 'Open Setup and complete the highlighted required field.'
    case 'broken-variable':
      return 'Replace the missing variable with an available upstream variable.'
    case 'invalid-mapping':
      return 'Choose a variable whose type matches the target field.'
    case 'disconnected-node':
    case 'orphan-node':
    case 'unreachable-node':
      return 'Connect this step to the active workflow path or remove it.'
    case 'cycle':
      return 'Remove the circular connection before running this workflow.'
    case 'dead-branch':
      return 'Connect this branch to a downstream action or remove the branch path.'
    case 'empty-branch':
      return 'Connect each required branch path or mark the path optional in registry metadata.'
    case 'duplicate-connection':
      return 'Remove the duplicate connection so the path executes once.'
    case 'branch-structure':
      return 'Review the branch configuration and connect required paths.'
    case 'unknown-node':
      return 'Replace this step with a supported registry-backed workflow node.'
    case 'duplicate-node-id':
      return 'Regenerate or replace one of the duplicate nodes so every step has a stable unique ID.'
    case 'deprecated-node':
      return 'Replace this step with the current registry-supported version.'
    case 'node-requires-authentication':
      return 'Connect the required provider or credential before publishing.'
    case 'node-requires-configuration':
      return 'Finish the provider or workspace configuration required by this step.'
    case 'node-coming-soon':
      return 'Choose a currently available step until this capability is released.'
    case 'node-unavailable-for-workspace':
      return 'Enable the required workspace capability or choose another step.'
    case 'node-unavailable-for-plan':
      return 'Upgrade the workspace plan or choose a step available on the current plan.'
    case 'invalid-url':
      return fieldLabel
        ? `Enter a valid URL in ${fieldLabel}.`
        : 'Enter a valid URL.'
    case 'large-workflow':
      return 'Consider splitting the workflow into smaller reusable automations.'
    case 'complex-branching':
      return 'Review branch paths and naming before publishing.'
    case 'deep-workflow':
      return 'Review the longest path for runtime cost and operational clarity.'
    case 'runtime-readiness':
      return 'Resolve blocking setup issues before execution.'
    case 'best-practice':
    default:
      return 'Review this recommendation when preparing the workflow for production.'
  }
}

function fromHealthIssue(
  issue: WorkflowHealthIssue,
  nodeMap: Map<string, Node>,
): WorkflowExecutionValidationIssue {
  const node = issue.nodeId ? nodeMap.get(issue.nodeId) : undefined
  return {
    id: issue.id,
    severity: issue.severity === 'suggestion' ? 'info' : issue.severity,
    code: issue.code,
    nodeId: issue.nodeId,
    nodeTitle: nodeTitle(node),
    edgeId: issue.edgeId,
    message: issue.description,
    suggestedResolution: suggestionForCode(issue.code, node, issue.field),
    inspectorField: issue.field,
    source: sourceForHealthIssue(issue),
  }
}

function fromOptimization(
  issue: WorkflowHealthOptimization,
  nodeMap: Map<string, Node>,
): WorkflowExecutionValidationIssue {
  const node = issue.nodeId ? nodeMap.get(issue.nodeId) : undefined
  return {
    id: issue.id,
    severity: 'info',
    code: 'best-practice',
    nodeId: issue.nodeId,
    nodeTitle: nodeTitle(node),
    message: issue.description,
    suggestedResolution: suggestionForCode('best-practice', node),
    source: 'runtime',
  }
}

function availabilityCode(
  state: WorkflowNodeAvailabilityState,
): WorkflowValidationIssueCode | null {
  if (state === 'requiresAuthentication') return 'node-requires-authentication'
  if (state === 'requiresConfiguration') return 'node-requires-configuration'
  if (state === 'comingSoon') return 'node-coming-soon'
  if (state === 'unavailableForWorkspace')
    return 'node-unavailable-for-workspace'
  if (state === 'unavailableForPlan') return 'node-unavailable-for-plan'
  return null
}

function isBlockingAvailability(state: WorkflowNodeAvailabilityState) {
  return state !== 'available' && state !== 'requiresConfiguration'
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function registryIssues(nodes: Node[]) {
  const issues: WorkflowExecutionValidationIssue[] = []
  const counts = new Map<string, number>()
  for (const node of nodes) counts.set(node.id, (counts.get(node.id) ?? 0) + 1)

  for (const node of nodes) {
    const registryId = registryIdForNode(node)
    const definition = getWorkflowNodeDefinition(registryId)
    const title = nodeTitle(node) ?? registryId

    if ((counts.get(node.id) ?? 0) > 1) {
      issues.push({
        id: stableIssueId(['duplicate-node-id', node.id]),
        severity: 'error',
        code: 'duplicate-node-id',
        nodeId: node.id,
        nodeTitle: title,
        message: `${title} has a duplicate internal step ID.`,
        suggestedResolution: suggestionForCode('duplicate-node-id', node),
        source: 'registry',
      })
    }

    if (!definition) {
      issues.push({
        id: stableIssueId(['unknown-node', node.id, registryId]),
        severity: 'error',
        code: 'unknown-node',
        nodeId: node.id,
        nodeTitle: title,
        message: `${title} is not registered as a supported workflow step.`,
        suggestedResolution: suggestionForCode('unknown-node', node),
        source: 'registry',
      })
      continue
    }

    const availability = definition.availability ?? {
      state: 'available' as const,
    }
    const code = availabilityCode(availability.state)
    if (code) {
      issues.push({
        id: stableIssueId([code, node.id, registryId]),
        severity: isBlockingAvailability(availability.state)
          ? 'error'
          : 'warning',
        code,
        nodeId: node.id,
        nodeTitle: title,
        message:
          availability.message ??
          `${definition.label} is ${availability.label ?? availability.state}.`,
        suggestedResolution: suggestionForCode(code, node),
        source: 'registry',
      })
    }

    if (Boolean((definition as { deprecated?: boolean }).deprecated)) {
      issues.push({
        id: stableIssueId(['deprecated-node', node.id, registryId]),
        severity: 'warning',
        code: 'deprecated-node',
        nodeId: node.id,
        nodeTitle: title,
        message: `${definition.label} uses a deprecated registry definition.`,
        suggestedResolution: suggestionForCode('deprecated-node', node),
        source: 'registry',
      })
    }

    const data = (node.data ?? {}) as Record<string, unknown>
    for (const field of definition.configFields) {
      const value = data[field.id] ?? (field.key ? data[field.key] : undefined)
      if (
        typeof value === 'string' &&
        value.trim() &&
        (field.semanticType === 'url' ||
          field.acceptedTypes?.includes('url')) &&
        !value.includes('{{') &&
        !isValidUrl(value.trim())
      ) {
        issues.push({
          id: stableIssueId(['invalid-url', node.id, field.id]),
          severity: 'error',
          code: 'invalid-url',
          nodeId: node.id,
          nodeTitle: title,
          message: `${definition.label}: ${field.label} must be a valid URL.`,
          suggestedResolution: suggestionForCode('invalid-url', node, field.id),
          inspectorField: field.id,
          source: 'node',
        })
      }
    }
  }
  return issues
}

function performanceIssues(
  health: WorkflowHealth,
): WorkflowExecutionValidationIssue[] {
  const issues: WorkflowExecutionValidationIssue[] = []
  if (health.executionReadiness.nodeCount >= 75) {
    issues.push({
      id: 'large-workflow:node-count',
      severity: 'warning',
      code: 'large-workflow',
      message: `This workflow has ${health.executionReadiness.nodeCount} steps.`,
      suggestedResolution: suggestionForCode('large-workflow'),
      source: 'runtime',
    })
  } else if (health.executionReadiness.nodeCount >= 40) {
    issues.push({
      id: 'large-workflow:node-count:info',
      severity: 'info',
      code: 'large-workflow',
      message: `This workflow has ${health.executionReadiness.nodeCount} steps. Review runtime cost before publishing.`,
      suggestedResolution: suggestionForCode('large-workflow'),
      source: 'runtime',
    })
  }
  if (health.executionReadiness.branchCount >= 8) {
    issues.push({
      id: 'complex-branching:branch-count',
      severity: 'warning',
      code: 'complex-branching',
      message: `This workflow has ${health.executionReadiness.branchCount} branch points.`,
      suggestedResolution: suggestionForCode('complex-branching'),
      source: 'branch',
    })
  }
  if (health.executionReadiness.longestPath >= 20) {
    issues.push({
      id: 'deep-workflow:longest-path',
      severity: 'info',
      code: 'deep-workflow',
      message: `The longest execution path has ${health.executionReadiness.longestPath} steps.`,
      suggestedResolution: suggestionForCode('deep-workflow'),
      source: 'runtime',
    })
  }
  return issues
}

function dedupeIssues(issues: WorkflowExecutionValidationIssue[]) {
  const seen = new Set<string>()
  const next: WorkflowExecutionValidationIssue[] = []
  for (const issue of issues) {
    const key = `${issue.id}:${issue.severity}:${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(issue)
  }
  return next
}

export function evaluateWorkflowReadiness(
  issues: WorkflowExecutionValidationIssue[],
  context: WorkflowValidationContext = 'publish',
): WorkflowReadinessEvaluation {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const info = issues.filter((issue) => issue.severity === 'info')
  if (errors.length) {
    return {
      state: 'cannot-publish',
      label: 'Cannot publish',
      canPreview: false,
      canTest: false,
      canPublish: false,
      canExecute: false,
      requiresWarningConfirmation: false,
      blockingIssueIds: errors.map((issue) => issue.id),
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: info.length,
    }
  }
  if (warnings.length) {
    if (context !== 'publish') {
      return {
        state: 'needs-attention',
        label: 'Needs attention',
        canPreview: true,
        canTest: true,
        canPublish: true,
        canExecute: true,
        requiresWarningConfirmation: false,
        blockingIssueIds: [],
        errorCount: 0,
        warningCount: warnings.length,
        infoCount: info.length,
      }
    }
    return {
      state: 'ready-with-warnings',
      label: 'Ready with warnings',
      canPreview: true,
      canTest: true,
      canPublish: true,
      canExecute: true,
      requiresWarningConfirmation: true,
      blockingIssueIds: [],
      errorCount: 0,
      warningCount: warnings.length,
      infoCount: info.length,
    }
  }
  return {
    state: 'ready',
    label: 'Ready',
    canPreview: true,
    canTest: true,
    canPublish: true,
    canExecute: true,
    requiresWarningConfirmation: false,
    blockingIssueIds: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: info.length,
  }
}

export function validateWorkflowForExecution({
  nodes,
  edges,
  context = 'publish',
}: {
  nodes: Node[]
  edges: Edge[]
  context?: WorkflowValidationContext
}): WorkflowValidationReport {
  const health = analyzeWorkflowHealth({ nodes, edges })
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const issues = dedupeIssues([
    ...health.errors.map((issue) => fromHealthIssue(issue, nodeMap)),
    ...health.warnings.map((issue) => fromHealthIssue(issue, nodeMap)),
    ...health.suggestions.map((issue) => fromHealthIssue(issue, nodeMap)),
    ...health.optimizations.map((issue) => fromOptimization(issue, nodeMap)),
    ...health.futureRecommendations.map((issue) =>
      fromHealthIssue(issue, nodeMap),
    ),
    ...registryIssues(nodes),
    ...performanceIssues(health),
  ])
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const info = issues.filter((issue) => issue.severity === 'info')
  const readiness = evaluateWorkflowReadiness(issues, context)
  const fingerprint = getWorkflowExecutionFingerprint({ nodes, edges })
  return {
    id: `workflow-validation:${fingerprint}`,
    context,
    fingerprint,
    generatedAt: new Date().toISOString(),
    issues,
    errors,
    warnings,
    info,
    readiness,
    health,
  }
}

export function summarizeWorkflowValidation(
  report: WorkflowValidationReport,
): WorkflowExecutionValidationSnapshot {
  return {
    status: report.readiness.canExecute
      ? report.readiness.requiresWarningConfirmation
        ? 'passed-with-warnings'
        : 'passed'
      : 'blocked',
    readinessState: report.readiness.state,
    readinessLabel: report.readiness.label,
    errorCount: report.errors.length,
    warningCount: report.warnings.length,
    infoCount: report.info.length,
    issueIds: report.issues.map((issue) => issue.id),
    blockingIssueIds: report.readiness.blockingIssueIds,
  }
}

export function groupWorkflowValidationIssues(
  report: WorkflowValidationReport,
) {
  return {
    errors: report.errors,
    warnings: report.warnings,
    info: report.info,
  }
}

import type { Edge, Node } from 'reactflow'

import type { BuilderValidationIssue } from '@/lib/workflows/builderValidation'
import {
  buildWorkflowExecutionGraph,
  executeWorkflowPreview,
  type WorkflowExecutionReport,
} from '@/lib/workflows/executionEngine'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { WorkflowExecution } from '@/lib/workflows/types'
import {
  getWorkflowExecutionFingerprint,
  summarizeWorkflowValidation,
  validateWorkflowForExecution,
  type WorkflowValidationReport,
} from '@/lib/workflows/workflowValidator'

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function nodeLabel(node?: Node) {
  if (!node) return 'Workflow Structure'
  const data = node.data as { label?: unknown } | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    'Step'
  )
}

export async function createWorkflowExecutionPreview({
  automationId,
  workspaceId,
  nodes,
  edges,
}: {
  automationId: string
  workspaceId: string
  nodes: Node[]
  edges: Edge[]
}): Promise<WorkflowExecutionReport> {
  const validationReport = validateWorkflowForExecution({
    nodes,
    edges,
    context: 'preview',
  })
  if (!validationReport.readiness.canPreview) {
    return createWorkflowPreflightFailurePreview({
      automationId,
      workspaceId,
      issues: validationReport.errors.map(
        (issue): BuilderValidationIssue => ({
          id: issue.id,
          severity: 'error',
          message: issue.message,
          nodeId: issue.nodeId,
          field: issue.inspectorField,
        }),
      ),
      nodes,
      edges,
      validationReport,
    }) as WorkflowExecutionReport
  }
  return executeWorkflowPreview({
    automationId,
    workspaceId,
    nodes,
    edges,
    validationReport,
  })
}

export function createWorkflowPreflightFailurePreview({
  automationId,
  workspaceId,
  issues,
  nodes = [],
  edges = [],
  validationReport,
  workflowFingerprint: providedWorkflowFingerprint,
}: {
  automationId: string
  workspaceId: string
  issues: BuilderValidationIssue[]
  nodes?: Node[]
  edges?: Edge[]
  validationReport?: WorkflowValidationReport
  workflowFingerprint?: string
}): WorkflowExecution {
  const graph = buildWorkflowExecutionGraph({ nodes, edges })
  const workflowFingerprint =
    providedWorkflowFingerprint ??
    validationReport?.fingerprint ??
    getWorkflowExecutionFingerprint({ nodes, edges })
  const now = new Date().toISOString()
  const executionId = `preview-${automationId}-${Date.now()}`
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
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const groupedIssues = Array.from(
    visibleIssues.reduce<Map<string, BuilderValidationIssue[]>>(
      (groups, issue) => {
        const key = issue.nodeId ?? 'workflow'
        const group = groups.get(key) ?? []
        if (!group.some((item) => item.message === issue.message)) {
          group.push(issue)
        }
        groups.set(key, group)
        return groups
      },
      new Map(),
    ),
  )
  const totalErrors = visibleIssues.filter(
    (issue) => issue.severity === 'error',
  ).length
  const totalWarnings = visibleIssues.filter(
    (issue) => issue.severity === 'warning',
  ).length
  const steps = groupedIssues.map(([nodeId, group], index) => ({
    id: `${executionId}:preflight:${index}`,
    runId: executionId,
    nodeId,
    nodeType: 'validation',
    label: `${nodeLabel(nodeMap.get(nodeId))} — Failed`,
    status: 'failed' as const,
    startedAt: now,
    finishedAt: now,
    error: group[0]?.message,
    logs: group.map((issue, issueIndex) => ({
      id: `${executionId}:preflight-log:${index}:${issueIndex}`,
      timestamp: now,
      level:
        issue.severity === 'warning'
          ? ('warning' as const)
          : ('error' as const),
      message: issue.message,
      nodeId,
      issueId: issue.id,
    })),
    output: {},
  }))

  return {
    id: executionId,
    workflowId: automationId,
    workspaceId,
    status: 'failed',
    triggerSource: 'Cannot preview',
    startedAt: now,
    finishedAt: now,
    steps,
    logs: steps.flatMap((step) => step.logs),
    error: visibleIssues[0]?.message ?? 'Cannot preview.',
    mode: 'preview',
    runKind: 'preview',
    workflowFingerprint,
    graph,
    validation: validationReport
      ? summarizeWorkflowValidation(validationReport)
      : {
          status: 'blocked',
          readinessState: 'cannot-publish',
          readinessLabel: 'Cannot publish',
          errorCount: totalErrors,
          warningCount: totalWarnings,
          infoCount: 0,
          issueIds: visibleIssues.map((issue) => issue.id),
          blockingIssueIds: visibleIssues.map((issue) => issue.id),
        },
    summary: {
      workflow: automationId,
      completed: 0,
      failed: steps.length,
      skipped: 0,
      executionTimeMs: 0,
      variablesCreated: 0,
      variablesUsed: 0,
      nodesExecuted: 0,
      warnings: totalWarnings,
      errors: totalErrors,
      branchCount: 0,
      estimatedRuntimeMs: 0,
    },
    replay: {
      timestamp: now,
      workflowVersion: 'preview-local',
      executionGraph: graph,
      variables: {},
      logs: steps.flatMap((step) => step.logs),
      outputs: {},
    },
  } as WorkflowExecution
}

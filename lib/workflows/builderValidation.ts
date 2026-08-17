import type { Edge, Node } from 'reactflow'

import { type WorkflowHealth } from '@/lib/workflows/workflowHealth'
import type { NodeValidationResult } from '@/lib/workflows/nodeValidation'
import {
  validateWorkflowForExecution,
  type WorkflowExecutionValidationIssue,
  type WorkflowValidationReport,
} from '@/lib/workflows/workflowValidator'

export type BuilderNodeValidationState =
  | 'ready'
  | 'warning'
  | 'error'
  | 'disconnected'

export type BuilderValidationIssue = {
  id: string
  severity: 'error' | 'warning' | 'suggestion'
  message: string
  nodeId?: string
  field?: string
}

export type BuilderNodeValidation = {
  nodeId: string
  state: BuilderNodeValidationState
  status: NodeValidationResult['status']
  messages: NodeValidationResult['messages']
  disconnected: boolean
  blocked: boolean
}

export type BuilderValidationSummary = {
  health: number
  nodes: number
  connections: number
  errors: number
  warnings: number
  ready: number
  blocked: number
  missingTrigger: boolean
  missingEndPath: boolean
  progress: number
  nodeResults: Record<string, BuilderNodeValidation>
  issues: BuilderValidationIssue[]
  canPublish: boolean
  publishErrors: BuilderValidationIssue[]
  healthReport: WorkflowHealth
  validationReport: WorkflowValidationReport
  readinessState: WorkflowValidationReport['readiness']['state']
  readinessLabel: WorkflowValidationReport['readiness']['label']
  requiresWarningConfirmation: boolean
}

function toBuilderIssue(
  item: WorkflowExecutionValidationIssue,
): BuilderValidationIssue {
  return {
    id: item.id,
    severity: item.severity === 'info' ? 'suggestion' : item.severity,
    message: item.message,
    nodeId: item.nodeId,
    field: item.inspectorField,
  }
}

export function validateBuilderWorkflow({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): BuilderValidationSummary {
  const validationReport = validateWorkflowForExecution({
    nodes,
    edges,
    context: 'publish',
  })
  const healthReport = validationReport.health
  const warningIssues = validationReport.warnings.map(toBuilderIssue)
  const suggestionIssues = validationReport.info.map(toBuilderIssue)
  const issues = [
    ...validationReport.errors.map(toBuilderIssue),
    ...warningIssues,
    ...suggestionIssues,
  ]
  const nodeResults = Object.fromEntries(
    Object.values(healthReport.nodeResults).map((result) => [
      result.nodeId,
      {
        nodeId: result.nodeId,
        state: result.state,
        status: result.status,
        messages: result.messages,
        disconnected: result.disconnected,
        blocked: result.blocked,
      } satisfies BuilderNodeValidation,
    ]),
  )

  return {
    health: healthReport.score.value,
    nodes: healthReport.executionReadiness.nodeCount,
    connections: healthReport.executionReadiness.connectionCount,
    errors: validationReport.errors.length,
    warnings: validationReport.warnings.length,
    ready: healthReport.readyNodes.length,
    blocked: healthReport.blockedNodes.length,
    missingTrigger: healthReport.graph.triggerNodeIds.length === 0,
    missingEndPath:
      healthReport.graph.endNodeIds.length === 0 && nodes.length > 0,
    progress: nodes.length
      ? Math.round((healthReport.readyNodes.length / nodes.length) * 100)
      : 0,
    nodeResults,
    issues,
    canPublish: validationReport.readiness.canPublish,
    publishErrors: validationReport.errors.map(toBuilderIssue),
    healthReport,
    validationReport,
    readinessState: validationReport.readiness.state,
    readinessLabel: validationReport.readiness.label,
    requiresWarningConfirmation:
      validationReport.readiness.requiresWarningConfirmation,
  }
}

import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { validateBuilderWorkflow } from '@/lib/workflows/builderValidation'
import type { WorkflowExecutionReport } from '@/lib/workflows/executionEngine'
import {
  createWorkflowExecutionPreview,
  createWorkflowPreflightFailurePreview,
} from '@/lib/workflows/executionPreview'
import {
  createWorkflowRunHistoryItem,
  workflowRunKindLabel,
} from '@/lib/workflows/runHistory'
import {
  getPreviewFreshness,
  getWorkflowExecutionFingerprint,
  validateWorkflowForExecution,
} from '@/lib/workflows/workflowValidator'

function node(
  id: string,
  registryId: string,
  data: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: registryId,
    position: { x: 0, y: 0 },
    data: {
      label: data.label ?? registryId,
      __registryNodeId: registryId,
      ...data,
    },
  } as Node
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'default',
  }
}

describe('workflow execution validator', () => {
  it('marks a complete workflow as ready while preserving info-only recommendations', () => {
    const report = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: 'Hello',
        }),
      ],
      edges: [edge('lead', 'email')],
      context: 'publish',
    })

    expect(report.readiness.state).toBe('ready')
    expect(report.readiness.canPreview).toBe(true)
    expect(report.readiness.canPublish).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.info.length).toBeGreaterThan(0)
  })

  it('treats warnings as publishable with confirmation', () => {
    const report = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: 'email',
          subject: 'Follow up',
          body: 'Hi',
        }),
      ],
      edges: [edge('lead', 'email')],
    })

    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'best-practice', nodeId: 'email' }),
      ]),
    )
    expect(report.readiness.state).toBe('ready-with-warnings')
    expect(report.readiness.canPublish).toBe(true)
    expect(report.readiness.requiresWarningConfirmation).toBe(true)
  })

  it('uses needs-attention for non-publish contexts that have warnings', () => {
    const report = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: 'email',
          subject: 'Follow up',
          body: 'Hi',
        }),
      ],
      edges: [edge('lead', 'email')],
      context: 'preview',
    })

    expect(report.readiness.state).toBe('needs-attention')
    expect(report.readiness.canPreview).toBe(true)
    expect(report.readiness.requiresWarningConfirmation).toBe(false)
  })

  it('blocks preview, test, publish, and execution for missing required setup', () => {
    const report = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('sms', 'send.sms', { phone: '', message: 'Hi' }),
      ],
      edges: [edge('lead', 'sms')],
      context: 'preview',
    })

    expect(report.readiness.state).toBe('cannot-publish')
    expect(report.readiness.canPreview).toBe(false)
    expect(report.readiness.canTest).toBe(false)
    expect(report.readiness.canPublish).toBe(false)
    expect(report.readiness.canExecute).toBe(false)
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-required-field',
          inspectorField: 'phone',
          suggestedResolution: expect.stringContaining('Phone'),
        }),
      ]),
    )
  })

  it('uses registry availability metadata to block unauthenticated scheduling nodes', () => {
    const report = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('connect-calendar', 'scheduling.action.connect_calendar', {
          provider: 'google',
        }),
      ],
      edges: [edge('lead', 'connect-calendar')],
      context: 'publish',
    })

    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'node-requires-authentication',
          nodeId: 'connect-calendar',
          source: 'registry',
        }),
      ]),
    )
    expect(report.readiness.canPublish).toBe(false)
  })

  it('detects unsupported registry node ids and duplicate node ids', () => {
    const report = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('duplicate', 'unknown.workflow.node'),
        node('duplicate', 'task.create', { title: 'Follow up' }),
      ],
      edges: [edge('lead', 'duplicate')],
    })

    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unknown-node', nodeId: 'duplicate' }),
        expect.objectContaining({
          code: 'duplicate-node-id',
          nodeId: 'duplicate',
        }),
      ]),
    )
  })

  it('keeps builder validation backed by the shared readiness report', () => {
    const validation = validateBuilderWorkflow({
      nodes: [
        node('lead', 'lead.created'),
        node('webhook', 'webhook.placeholder', { method: 'POST' }),
      ],
      edges: [edge('lead', 'webhook')],
    })

    expect(validation.validationReport.readiness.state).toBe('cannot-publish')
    expect(validation.canPublish).toBe(false)
    expect(validation.publishErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'url' })]),
    )
  })

  it('creates preflight previews with validation status for run history', () => {
    const validationReport = validateWorkflowForExecution({
      nodes: [node('email', 'send.email', { recipient: 'owner@example.com' })],
      edges: [],
      context: 'preview',
    })
    const execution = createWorkflowPreflightFailurePreview({
      automationId: 'automation-1',
      workspaceId: 'workspace-1',
      nodes: [node('email', 'send.email', { recipient: 'owner@example.com' })],
      edges: [],
      issues: validationReport.errors.map((issue) => ({
        id: issue.id,
        severity: 'error',
        message: issue.message,
        nodeId: issue.nodeId,
        field: issue.inspectorField,
      })),
      validationReport,
    })
    const history = createWorkflowRunHistoryItem(
      execution as WorkflowExecutionReport,
    )

    expect(execution.validation).toMatchObject({
      status: 'blocked',
      readinessState: 'cannot-publish',
    })
    expect(history.validation).toEqual(execution.validation)
  })

  it('prevents preview entry-point execution when shared validation finds blockers', async () => {
    const execution = await createWorkflowExecutionPreview({
      automationId: 'automation-1',
      workspaceId: 'workspace-1',
      nodes: [node('email', 'send.email', { recipient: 'owner@example.com' })],
      edges: [],
    })

    expect(execution.status).toBe('failed')
    expect(execution.validation).toMatchObject({
      status: 'blocked',
      readinessState: 'cannot-publish',
    })
    expect(execution.steps[0]?.nodeType).toBe('validation')
  })

  it('removes live validation errors immediately after a missing phone mapping is fixed', () => {
    const smsMissingPhone = node('sms', 'send.sms', {
      phone: '',
      message: 'Hi',
    })
    const smsMappedPhone = node('sms', 'send.sms', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'Hi',
    })
    const nodesWithMissingPhone = [
      node('lead', 'lead.created'),
      smsMissingPhone,
    ]
    const nodesWithMappedPhone = [node('lead', 'lead.created'), smsMappedPhone]
    const edges = [edge('lead', 'sms')]

    const before = validateBuilderWorkflow({
      nodes: nodesWithMissingPhone,
      edges,
    })
    const after = validateBuilderWorkflow({
      nodes: nodesWithMappedPhone,
      edges,
    })

    expect(before.publishErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'sms', field: 'phone' }),
      ]),
    )
    expect(after.publishErrors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'sms', field: 'phone' }),
      ]),
    )
    expect(after.canPublish).toBe(true)
  })

  it('uses validation-relevant workflow fingerprints for preview freshness', () => {
    const baseNodes = [
      node('lead', 'lead.created'),
      node('sms', 'send.sms', {
        phone: '{{nodes.lead.lead.phone}}',
        message: 'Hi',
      }),
    ]
    const baseEdges = [edge('lead', 'sms')]
    const currentFingerprint = getWorkflowExecutionFingerprint({
      nodes: baseNodes,
      edges: baseEdges,
    })
    const movedFingerprint = getWorkflowExecutionFingerprint({
      nodes: baseNodes.map((item) =>
        item.id === 'sms' ? { ...item, position: { x: 400, y: 200 } } : item,
      ),
      edges: baseEdges,
    })
    const runtimeAnnotatedFingerprint = getWorkflowExecutionFingerprint({
      nodes: baseNodes.map((item) =>
        item.id === 'sms'
          ? {
              ...item,
              data: {
                ...(item.data as Record<string, unknown>),
                __lastPreviewStatus: 'failed',
              },
            }
          : item,
      ),
      edges: baseEdges,
    })
    const editedFingerprint = getWorkflowExecutionFingerprint({
      nodes: baseNodes.map((item) =>
        item.id === 'sms'
          ? {
              ...item,
              data: {
                ...(item.data as Record<string, unknown>),
                message: 'Hello there',
              },
            }
          : item,
      ),
      edges: baseEdges,
    })
    const previewInputFingerprint = getWorkflowExecutionFingerprint({
      nodes: baseNodes,
      edges: baseEdges,
      previewInputFingerprint: 'owner=team-ops',
    })

    expect(
      getPreviewFreshness({
        previewFingerprint: null,
        currentFingerprint,
      }),
    ).toBe('none')
    expect(movedFingerprint).toBe(currentFingerprint)
    expect(runtimeAnnotatedFingerprint).toBe(currentFingerprint)
    expect(editedFingerprint).not.toBe(currentFingerprint)
    expect(previewInputFingerprint).not.toBe(currentFingerprint)
    expect(
      getPreviewFreshness({
        previewFingerprint: currentFingerprint,
        currentFingerprint,
      }),
    ).toBe('current')
    expect(
      getPreviewFreshness({
        previewFingerprint: currentFingerprint,
        currentFingerprint: editedFingerprint,
      }),
    ).toBe('out_of_date')
  })

  it('stores run kind, workflow fingerprint, and validation snapshot in run history', () => {
    const validationReport = validateWorkflowForExecution({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow up',
          body: 'Hi',
        }),
      ],
      edges: [edge('lead', 'email')],
      context: 'preview',
    })
    const baseExecution = {
      id: 'run-1',
      workflowId: 'workflow-1',
      workspaceId: 'workspace-1',
      status: 'succeeded',
      triggerSource: 'Preview trigger fired',
      startedAt: '2026-07-29T12:00:00.000Z',
      finishedAt: '2026-07-29T12:00:01.000Z',
      steps: [],
      logs: [],
      mode: 'preview',
      runKind: 'preview',
      workflowFingerprint: validationReport.fingerprint,
      validation: {
        status: 'passed' as const,
        readinessState: validationReport.readiness.state,
        readinessLabel: validationReport.readiness.label,
        errorCount: 0,
        warningCount: 0,
        infoCount: validationReport.info.length,
        issueIds: validationReport.issues.map((issue) => issue.id),
        blockingIssueIds: [],
      },
      graph: {
        nodeOrder: [],
        adjacency: {},
        incoming: {},
        triggerNodeIds: [],
        orphanNodeIds: [],
        loopNodeIds: [],
        invalidBranchNodeIds: [],
        disconnectedPathNodeIds: [],
      },
      context: {
        executionId: 'run-1',
        workflowId: 'workflow-1',
        workspaceId: 'workspace-1',
        mode: 'preview',
        triggerData: {},
        variables: {},
        executionState: {},
        completedNodes: [],
        skippedNodes: [],
        failedNodes: [],
        outputs: {},
        startedAt: '2026-07-29T12:00:00.000Z',
      },
      summary: {
        workflow: 'workflow-1',
        completed: 0,
        failed: 0,
        skipped: 0,
        executionTimeMs: 1000,
        variablesCreated: 0,
        variablesUsed: 0,
        nodesExecuted: 0,
        warnings: 0,
        errors: 0,
        branchCount: 0,
        estimatedRuntimeMs: 0,
      },
      replay: {
        timestamp: '2026-07-29T12:00:01.000Z',
        workflowVersion: 'preview-local',
        executionGraph: {
          nodeOrder: [],
          adjacency: {},
          incoming: {},
          triggerNodeIds: [],
          orphanNodeIds: [],
          loopNodeIds: [],
          invalidBranchNodeIds: [],
          disconnectedPathNodeIds: [],
        },
        variables: {},
        logs: [],
        outputs: {},
      },
    } satisfies WorkflowExecutionReport

    const previewHistory = createWorkflowRunHistoryItem(baseExecution)
    const testHistory = createWorkflowRunHistoryItem({
      ...baseExecution,
      id: 'run-2',
      runKind: 'test',
    } satisfies WorkflowExecutionReport)
    const liveHistory = createWorkflowRunHistoryItem({
      ...baseExecution,
      id: 'run-3',
      mode: 'production',
      runKind: 'live',
    } satisfies WorkflowExecutionReport)

    expect(previewHistory.runKind).toBe('preview')
    expect(testHistory.runKind).toBe('test')
    expect(liveHistory.runKind).toBe('live')
    expect(workflowRunKindLabel(previewHistory.runKind)).toBe('Preview Run')
    expect(workflowRunKindLabel(testHistory.runKind)).toBe('Test Run')
    expect(workflowRunKindLabel(liveHistory.runKind)).toBe('Live Run')
    expect(previewHistory.workflowFingerprint).toBe(
      validationReport.fingerprint,
    )
    expect(previewHistory.validation).toEqual(baseExecution.validation)
  })
})

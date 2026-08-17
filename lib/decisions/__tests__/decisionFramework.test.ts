import { describe, expect, it } from 'vitest'

import {
  DecisionFramework,
  attachDecisionExplanation,
  closeDecision,
  createDecision,
  createDecisionReference,
  createDecisionReferenceFromKnowledge,
  decisionFrameworkRegistry,
  filterDecisionsForActor,
  updateDecisionApproval,
  updateDecisionExecution,
  updateDecisionOutcome,
  type DecisionActor,
  type DecisionProposal,
  type DecisionReference,
  type DecisionSource,
} from '@/lib/decisions/decisionFramework'
import type { ActionProposal } from '@/lib/ai/runtime/workspaceAIRuntime'
import type {
  WorkspaceKnowledgeReference,
  WorkspaceRecommendationReason,
  WorkspaceRecommendationWarning,
} from '@/lib/intelligence/workspaceIntelligence'

const now = new Date('2026-07-30T12:00:00.000Z')
const later = new Date('2026-07-30T12:15:00.000Z')

const source: DecisionSource = {
  type: 'workspaceAI',
  id: 'workspace-ai',
  label: 'Workspace AI',
}

const actor: DecisionActor = {
  userId: 'user-1',
  workspaceMemberId: 'member-1',
  role: 'MANAGER',
  permissions: ['scheduling:write', 'decisions:read'],
}

const schedulingReference: WorkspaceKnowledgeReference = {
  id: 'schedule-snapshot-1',
  providerId: 'scheduling',
  domain: 'scheduling',
  kind: 'snapshot',
  label: 'Scheduling snapshot',
  scope: 'workspace',
}

const recommendationReference: DecisionReference = createDecisionReference({
  id: 'decision-reference:recommendation:rec-1',
  kind: 'recommendation',
  label: 'Recommended schedule change',
  providerId: 'scheduling',
  sourceId: 'rec-1',
})

function actionProposal(
  overrides: Partial<ActionProposal> = {},
): ActionProposal {
  return {
    id: 'proposal-1',
    actionType: 'scheduling.rescheduleAppointment',
    label: 'Move appointment to the best available slot',
    targetProviderId: 'scheduling',
    requiredToolId: 'scheduling.reschedule',
    confidence: 'high',
    parameters: { eventId: 'event-1', slotId: 'slot-1' },
    references: [schedulingReference],
    ...overrides,
  }
}

function decisionProposal(
  overrides: Partial<DecisionProposal> = {},
): DecisionProposal {
  return {
    id: 'proposal-shared-1',
    actionType: 'workflow.approveDraft',
    label: 'Approve workflow draft',
    source,
    confidence: 'medium',
    references: [
      createDecisionReference({
        id: 'decision-reference:workflow:workflow-1',
        kind: 'workflow',
        label: 'Workflow draft',
        sourceId: 'workflow-1',
      }),
    ],
    createdAt: now.toISOString(),
    ...overrides,
  }
}

function baseDecision(
  overrides: Partial<Parameters<typeof createDecision>[0]> = {},
) {
  return createDecision({
    id: 'decision-1',
    workspaceId: 'workspace-1',
    source,
    actor,
    intent: 'scheduling.rescheduleAppointment',
    proposal: actionProposal(),
    recommendationReference,
    reasons: [
      {
        code: 'availability',
        label: 'Member has the best availability.',
        source: 'scheduling',
      },
    ],
    warnings: [
      {
        code: 'notify-customer',
        label: 'Customer notification is recommended.',
        source: 'scheduling',
        severity: 'info',
      },
    ],
    approval: {
      requiredPermissions: ['scheduling:write'],
    },
    now,
    ...overrides,
  })
}

describe('Decision Framework foundation', () => {
  it('exposes a registry for deterministic decision governance without execution', () => {
    expect(decisionFrameworkRegistry.supportedSources).toEqual([
      'human',
      'workspaceAI',
      'automation',
      'workflow',
      'operationsIntelligence',
      'api',
      'integration',
    ])
    expect(decisionFrameworkRegistry.supportedApprovalStatuses).toContain(
      'deferred',
    )
    expect(decisionFrameworkRegistry.supportedExecutionStatuses).toContain(
      'queued',
    )
    expect(decisionFrameworkRegistry.supportedOutcomeStatuses).toContain(
      'rolledBack',
    )
    expect(decisionFrameworkRegistry.capabilities).toContain('doesNotExecute')
  })

  it('creates a decision from an AI runtime proposal while keeping proposal separate', () => {
    const decision = baseDecision()

    expect(decision.id).toBe('decision-1')
    expect(decision.proposal.id).toBe('proposal-1')
    expect(decision.proposalReference).toMatchObject({
      kind: 'proposal',
      sourceId: 'proposal-1',
    })
    expect(decision.approval.status).toBe('pending')
    expect(decision.execution.status).toBe('notStarted')
    expect(decision.outcome.status).toBe('notRecorded')
    expect(decision.lifecycleStatus).toBe('open')
    expect(decision.timeline.map((event) => event.type)).toEqual([
      'recommendationReceived',
      'proposalCreated',
    ])
    expect(
      decision.supportingReferences.map((reference) => reference.kind),
    ).toEqual(['workspaceSnapshot', 'recommendation'])
  })

  it('accepts an already normalized shared proposal without changing its source', () => {
    const proposal = decisionProposal()
    const decision = baseDecision({ proposal })

    expect(decision.proposal).toEqual(proposal)
    expect(decision.source).toEqual(source)
  })

  it('tracks approval updates including future multi-step approval history', () => {
    const approved = updateDecisionApproval(baseDecision(), {
      status: 'approved',
      actor,
      reason: 'Manager approved.',
      now: later,
    })
    const rejected = updateDecisionApproval(approved, {
      status: 'rejected',
      actor: { ...actor, workspaceMemberId: 'member-2' },
      reason: 'Later reviewer rejected.',
      now: new Date('2026-07-30T12:20:00.000Z'),
    })

    expect(rejected.approval.status).toBe('rejected')
    expect(rejected.approval.steps).toHaveLength(2)
    expect(rejected.approval.steps[0]).toMatchObject({
      status: 'approved',
      reason: 'Manager approved.',
    })
    expect(rejected.timeline.map((event) => event.type)).toContain(
      'approvalUpdated',
    )
  })

  it('tracks execution state from external engines without executing them', () => {
    const queued = updateDecisionExecution(baseDecision(), {
      status: 'queued',
      externalRunId: 'run-1',
      executor: 'workflow-runtime',
      now: later,
    })

    expect(queued.execution).toMatchObject({
      status: 'queued',
      externalRunId: 'run-1',
      executor: 'workflow-runtime',
    })
    expect(queued.timeline.at(-1)).toMatchObject({
      type: 'executionUpdated',
      metadata: {
        status: 'queued',
        externalRunId: 'run-1',
        executor: 'workflow-runtime',
      },
    })
  })

  it('tracks outcome state and outcome references without duplicating large objects', () => {
    const outcomeReference = createDecisionReference({
      id: 'decision-reference:scheduling:event-1',
      kind: 'scheduling',
      label: 'Schedule event',
      providerId: 'scheduling',
      sourceId: 'event-1',
    })

    const completed = updateDecisionOutcome(baseDecision(), {
      status: 'partiallySucceeded',
      summary: 'Event moved, notification skipped.',
      references: [outcomeReference],
      now: later,
    })

    expect(completed.outcome).toMatchObject({
      status: 'partiallySucceeded',
      summary: 'Event moved, notification skipped.',
      references: [outcomeReference],
    })
    expect(completed.supportingReferences).toContainEqual(outcomeReference)
  })

  it('attaches structured explanations instead of paragraph blobs', () => {
    const reasons: WorkspaceRecommendationReason[] = [
      {
        code: 'load-balance',
        label: 'Balances team workload.',
        source: 'operations',
      },
    ]
    const warnings: WorkspaceRecommendationWarning[] = [
      {
        code: 'capacity',
        label: 'Team capacity is close to its limit.',
        source: 'operations',
        severity: 'warning',
      },
    ]

    const explained = attachDecisionExplanation(baseDecision(), {
      confidence: 'medium',
      reasons,
      warnings,
      supportingReferences: [recommendationReference],
      approvalDetails: {
        status: 'pending',
        requiredPermissions: ['scheduling:write'],
      },
      executionSummary: {
        status: 'notStarted',
      },
      now: later,
    })

    expect(explained.explanation).toMatchObject({
      confidence: 'medium',
      reasons,
      warnings,
      decisionSource: source,
      approvalDetails: {
        status: 'pending',
        requiredPermissions: ['scheduling:write'],
      },
    })
    expect(explained.timeline.at(-1)?.type).toBe('explanationAttached')
  })

  it('closes the deterministic timeline after outcome recording', () => {
    const closed = closeDecision(
      updateDecisionOutcome(baseDecision(), {
        status: 'succeeded',
        now: later,
      }),
      { actor, now: new Date('2026-07-30T12:30:00.000Z') },
    )

    expect(closed.lifecycleStatus).toBe('closed')
    expect(closed.timeline.at(-1)?.type).toBe('closed')
  })

  it('filters decision visibility by workspace and permissions', () => {
    const visible = baseDecision({
      id: 'visible',
      visibility: { requiredPermissions: ['scheduling:write'] },
    })
    const hiddenPermission = baseDecision({
      id: 'hidden-permission',
      approval: { requiredPermissions: ['commerce:write'] },
      visibility: { requiredPermissions: ['commerce:write'] },
    })
    const hiddenWorkspace = baseDecision({
      id: 'hidden-workspace',
      workspaceId: 'workspace-2',
    })
    const visibleToMember = baseDecision({
      id: 'visible-member',
      approval: { requiredPermissions: ['commerce:write'] },
      visibility: {
        requiredPermissions: ['commerce:write'],
        visibleToMemberIds: ['member-1'],
      },
    })

    expect(
      filterDecisionsForActor(
        [hiddenWorkspace, hiddenPermission, visibleToMember, visible],
        actor,
        'workspace-1',
      ).map((decision) => decision.id),
    ).toEqual(['visible', 'visible-member'])

    expect(
      filterDecisionsForActor(
        [hiddenWorkspace, hiddenPermission, visibleToMember, visible],
        { ...actor, role: 'OWNER', permissions: [] },
        'workspace-1',
      ).map((decision) => decision.id),
    ).toEqual(['hidden-permission', 'visible', 'visible-member'])
  })

  it('maps workspace knowledge references into compact decision references', () => {
    expect(createDecisionReferenceFromKnowledge(schedulingReference)).toEqual({
      id: 'decision-reference:knowledge:schedule-snapshot-1',
      kind: 'workspaceSnapshot',
      label: 'Scheduling snapshot',
      providerId: 'scheduling',
      sourceId: 'schedule-snapshot-1',
    })
    expect(
      createDecisionReferenceFromKnowledge({
        ...schedulingReference,
        id: 'recommendation-1',
        kind: 'recommendation',
      }),
    ).toMatchObject({
      kind: 'knowledgeReference',
      sourceId: 'recommendation-1',
    })
  })

  it('normalizes references deterministically and deduplicates by reference id', () => {
    const duplicate = createDecisionReference({
      id: 'decision-reference:external:b',
      kind: 'external',
      label: 'External reference',
    })
    const first = createDecisionReference({
      id: 'decision-reference:audit:a',
      kind: 'audit',
      label: 'Audit reference',
    })
    const decision = baseDecision({
      supportingReferences: [duplicate, first, duplicate],
      recommendationReference: undefined,
    })

    expect(
      decision.supportingReferences.map((reference) => reference.id),
    ).toEqual([
      'decision-reference:audit:a',
      'decision-reference:external:b',
      'decision-reference:knowledge:schedule-snapshot-1',
    ])
  })

  it('returns deterministic output when timestamps and input ids are fixed', () => {
    expect(baseDecision()).toEqual(baseDecision())
  })

  it('offers a reusable class facade for future producers and consumers', () => {
    const framework = new DecisionFramework()
    const decision = framework.receiveProposal({
      id: 'decision-from-framework',
      workspaceId: 'workspace-1',
      source,
      actor,
      proposal: actionProposal({ id: 'proposal-from-framework' }),
      now,
    })
    const approved = framework.updateApproval(decision, {
      status: 'approved',
      actor,
      now: later,
    })
    const completed = framework.updateExecution(approved, {
      status: 'completed',
      summary: 'External runtime completed.',
      now: later,
    })

    expect(framework.getRegistry().capabilities).toContain('tracksTimeline')
    expect(completed.execution.status).toBe('completed')
  })
})

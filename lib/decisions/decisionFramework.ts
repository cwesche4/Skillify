import type {
  ActionProposal,
  AIRuntimeConfidence,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import type { WorkspaceAISuggestedAction } from '@/lib/ai/experience/workspaceAIExperience'
import type {
  WorkspaceIntelligenceIntent,
  WorkspaceKnowledgeProviderId,
  WorkspaceKnowledgeReference,
  WorkspaceRecommendationReason,
  WorkspaceRecommendationWarning,
} from '@/lib/intelligence/workspaceIntelligence'

export type DecisionSourceType =
  | 'human'
  | 'workspaceAI'
  | 'automation'
  | 'workflow'
  | 'operationsIntelligence'
  | 'api'
  | 'integration'

export type DecisionApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deferred'
  | 'expired'
  | 'cancelled'

export type DecisionExecutionStatus =
  | 'notStarted'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'

export type DecisionOutcomeStatus =
  | 'notRecorded'
  | 'succeeded'
  | 'partiallySucceeded'
  | 'failed'
  | 'noChange'
  | 'superseded'
  | 'rolledBack'

export type DecisionLifecycleStatus = 'open' | 'closed'

export type DecisionTimelineEventType =
  | 'recommendationReceived'
  | 'proposalCreated'
  | 'approvalUpdated'
  | 'executionUpdated'
  | 'outcomeUpdated'
  | 'explanationAttached'
  | 'closed'

export type DecisionReferenceKind =
  | 'workspaceState'
  | 'workspaceSnapshot'
  | 'knowledgeReference'
  | 'recommendation'
  | 'proposal'
  | 'approval'
  | 'explanation'
  | 'provider'
  | 'run'
  | 'workflow'
  | 'scheduling'
  | 'crm'
  | 'commerce'
  | 'audit'
  | 'external'

export type DecisionReference = {
  id: string
  kind: DecisionReferenceKind
  label: string
  providerId?: WorkspaceKnowledgeProviderId
  sourceId?: string
  metadata?: Record<string, unknown>
}

export type DecisionActor = {
  userId?: string
  workspaceMemberId?: string
  role?: string
  permissions: string[]
}

export type DecisionSource = {
  type: DecisionSourceType
  id: string
  label: string
}

export type DecisionProposal = {
  id: string
  actionType: string
  label: string
  source: DecisionSource
  targetProviderId?: WorkspaceKnowledgeProviderId
  requiredToolId?: string
  parameters?: Record<string, unknown>
  confidence: AIRuntimeConfidence
  references: DecisionReference[]
  createdAt: string
}

export type DecisionApprovalStep = {
  id: string
  status: DecisionApprovalStatus
  requiredPermission?: string
  actor?: DecisionActor
  reason?: string
  decidedAt?: string
}

export type DecisionApproval = {
  id: string
  status: DecisionApprovalStatus
  requiredPermissions: string[]
  steps: DecisionApprovalStep[]
  updatedAt: string
}

export type DecisionExecution = {
  id: string
  status: DecisionExecutionStatus
  externalRunId?: string
  executor?: string
  summary?: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
}

export type DecisionOutcome = {
  id: string
  status: DecisionOutcomeStatus
  summary?: string
  references: DecisionReference[]
  updatedAt: string
}

export type DecisionExplanation = {
  id: string
  confidence: AIRuntimeConfidence
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  supportingReferences: DecisionReference[]
  decisionSource: DecisionSource
  approvalDetails?: {
    status: DecisionApprovalStatus
    requiredPermissions: string[]
  }
  executionSummary?: {
    status: DecisionExecutionStatus
    summary?: string
  }
  createdAt: string
}

export type DecisionTimelineEvent = {
  id: string
  type: DecisionTimelineEventType
  createdAt: string
  actor?: DecisionActor
  references: DecisionReference[]
  metadata?: Record<string, unknown>
}

export type DecisionVisibility = {
  workspaceId: string
  requiredPermissions: string[]
  visibleToMemberIds?: string[]
}

export type Decision = {
  id: string
  workspaceId: string
  source: DecisionSource
  actor?: DecisionActor
  intent?: WorkspaceIntelligenceIntent
  providerId?: WorkspaceKnowledgeProviderId
  recommendationReference?: DecisionReference
  proposalReference: DecisionReference
  proposal: DecisionProposal
  approval: DecisionApproval
  execution: DecisionExecution
  outcome: DecisionOutcome
  explanation?: DecisionExplanation
  lifecycleStatus: DecisionLifecycleStatus
  confidence: AIRuntimeConfidence
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  supportingReferences: DecisionReference[]
  visibility: DecisionVisibility
  timeline: DecisionTimelineEvent[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type DecisionFrameworkCapabilityKey =
  | 'tracksProposals'
  | 'tracksApprovals'
  | 'tracksExecutionState'
  | 'tracksOutcomes'
  | 'tracksExplanations'
  | 'tracksTimeline'
  | 'filtersByPermission'
  | 'doesNotExecute'

export type DecisionFrameworkRegistry = {
  decisionTypes: string[]
  supportedSources: DecisionSourceType[]
  supportedApprovalStatuses: DecisionApprovalStatus[]
  supportedExecutionStatuses: DecisionExecutionStatus[]
  supportedOutcomeStatuses: DecisionOutcomeStatus[]
  capabilities: DecisionFrameworkCapabilityKey[]
}

export type CreateDecisionInput = {
  id: string
  workspaceId: string
  source: DecisionSource
  actor?: DecisionActor
  intent?: WorkspaceIntelligenceIntent
  providerId?: WorkspaceKnowledgeProviderId
  proposal: DecisionProposal | ActionProposal | WorkspaceAISuggestedAction
  recommendationReference?: DecisionReference
  supportingReferences?: DecisionReference[]
  reasons?: WorkspaceRecommendationReason[]
  warnings?: WorkspaceRecommendationWarning[]
  approval?: Partial<DecisionApproval>
  visibility?: Partial<DecisionVisibility>
  metadata?: Record<string, unknown>
  now?: Date
}

export const decisionFrameworkRegistry: DecisionFrameworkRegistry = {
  decisionTypes: [
    'genericActionProposal',
    'humanRecommendation',
    'workspaceAIRecommendation',
    'automationRecommendation',
    'workflowRecommendation',
    'operationsInsightRecommendation',
  ],
  supportedSources: [
    'human',
    'workspaceAI',
    'automation',
    'workflow',
    'operationsIntelligence',
    'api',
    'integration',
  ],
  supportedApprovalStatuses: [
    'pending',
    'approved',
    'rejected',
    'deferred',
    'expired',
    'cancelled',
  ],
  supportedExecutionStatuses: [
    'notStarted',
    'queued',
    'executing',
    'completed',
    'failed',
    'cancelled',
    'skipped',
  ],
  supportedOutcomeStatuses: [
    'notRecorded',
    'succeeded',
    'partiallySucceeded',
    'failed',
    'noChange',
    'superseded',
    'rolledBack',
  ],
  capabilities: [
    'tracksProposals',
    'tracksApprovals',
    'tracksExecutionState',
    'tracksOutcomes',
    'tracksExplanations',
    'tracksTimeline',
    'filtersByPermission',
    'doesNotExecute',
  ],
}

export class DecisionFramework {
  constructor(
    private readonly registry: DecisionFrameworkRegistry = decisionFrameworkRegistry,
  ) {}

  getRegistry() {
    return this.registry
  }

  receiveProposal(input: CreateDecisionInput): Decision {
    return createDecision(input)
  }

  updateApproval(
    decision: Decision,
    update: {
      status: DecisionApprovalStatus
      actor?: DecisionActor
      reason?: string
      now?: Date
    },
  ): Decision {
    return updateDecisionApproval(decision, update)
  }

  updateExecution(
    decision: Decision,
    update: Partial<Omit<DecisionExecution, 'id' | 'updatedAt'>> & {
      status: DecisionExecutionStatus
      now?: Date
    },
  ): Decision {
    return updateDecisionExecution(decision, update)
  }

  updateOutcome(
    decision: Decision,
    update: {
      status: DecisionOutcomeStatus
      summary?: string
      references?: DecisionReference[]
      now?: Date
    },
  ): Decision {
    return updateDecisionOutcome(decision, update)
  }

  attachExplanation(
    decision: Decision,
    explanation: Omit<
      DecisionExplanation,
      'id' | 'createdAt' | 'decisionSource'
    > & {
      id?: string
      now?: Date
    },
  ): Decision {
    return attachDecisionExplanation(decision, explanation)
  }

  close(
    decision: Decision,
    update: { actor?: DecisionActor; now?: Date } = {},
  ): Decision {
    return closeDecision(decision, update)
  }

  filterVisible(
    decisions: Decision[],
    actor: DecisionActor,
    workspaceId: string,
  ): Decision[] {
    return filterDecisionsForActor(decisions, actor, workspaceId)
  }
}

export function createDecision(input: CreateDecisionInput): Decision {
  const createdAt = timestamp(input.now)
  const proposal = normalizeDecisionProposal({
    proposal: input.proposal,
    source: input.source,
    now: createdAt,
  })
  const proposalReference: DecisionReference = {
    id: `decision-reference:proposal:${proposal.id}`,
    kind: 'proposal',
    label: proposal.label,
    providerId: proposal.targetProviderId,
    sourceId: proposal.id,
  }
  const supportingReferences = normalizeReferences([
    ...proposal.references,
    ...(input.supportingReferences ?? []),
    ...(input.recommendationReference ? [input.recommendationReference] : []),
  ])
  const requiredPermissions =
    input.approval?.requiredPermissions ??
    input.visibility?.requiredPermissions ??
    []
  const approval: DecisionApproval = {
    id: input.approval?.id ?? `decision-approval:${input.id}`,
    status: input.approval?.status ?? 'pending',
    requiredPermissions,
    steps: input.approval?.steps ?? [],
    updatedAt: input.approval?.updatedAt ?? createdAt,
  }
  const execution: DecisionExecution = {
    id: `decision-execution:${input.id}`,
    status: 'notStarted',
    updatedAt: createdAt,
  }
  const outcome: DecisionOutcome = {
    id: `decision-outcome:${input.id}`,
    status: 'notRecorded',
    references: [],
    updatedAt: createdAt,
  }
  const timeline: DecisionTimelineEvent[] = [
    ...(input.recommendationReference
      ? [
          timelineEvent({
            decisionId: input.id,
            type: 'recommendationReceived',
            createdAt,
            actor: input.actor,
            references: [input.recommendationReference],
          }),
        ]
      : []),
    timelineEvent({
      decisionId: input.id,
      type: 'proposalCreated',
      createdAt,
      actor: input.actor,
      references: [proposalReference],
    }),
  ]

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    source: input.source,
    actor: input.actor,
    intent: input.intent,
    providerId: input.providerId ?? proposal.targetProviderId,
    recommendationReference: input.recommendationReference,
    proposalReference,
    proposal,
    approval,
    execution,
    outcome,
    lifecycleStatus: 'open',
    confidence: proposal.confidence,
    reasons: input.reasons ?? [],
    warnings: input.warnings ?? [],
    supportingReferences,
    visibility: {
      workspaceId: input.workspaceId,
      requiredPermissions,
      visibleToMemberIds: input.visibility?.visibleToMemberIds,
    },
    timeline,
    metadata: input.metadata,
    createdAt,
    updatedAt: createdAt,
  }
}

export function updateDecisionApproval(
  decision: Decision,
  {
    status,
    actor,
    reason,
    now,
  }: {
    status: DecisionApprovalStatus
    actor?: DecisionActor
    reason?: string
    now?: Date
  },
): Decision {
  const updatedAt = timestamp(now)
  const step: DecisionApprovalStep = {
    id: `decision-approval-step:${decision.id}:${decision.approval.steps.length + 1}`,
    status,
    actor,
    reason,
    decidedAt: updatedAt,
  }
  return touchDecision(decision, updatedAt, {
    approval: {
      ...decision.approval,
      status,
      steps: [...decision.approval.steps, step],
      updatedAt,
    },
    timeline: [
      ...decision.timeline,
      timelineEvent({
        decisionId: decision.id,
        type: 'approvalUpdated',
        createdAt: updatedAt,
        actor,
        references: [{ ...decision.proposalReference, kind: 'approval' }],
        metadata: { status, reason },
      }),
    ],
  })
}

export function updateDecisionExecution(
  decision: Decision,
  update: Partial<Omit<DecisionExecution, 'id' | 'updatedAt'>> & {
    status: DecisionExecutionStatus
    now?: Date
  },
): Decision {
  const updatedAt = timestamp(update.now)
  return touchDecision(decision, updatedAt, {
    execution: {
      ...decision.execution,
      ...withoutNow(update),
      updatedAt,
    },
    timeline: [
      ...decision.timeline,
      timelineEvent({
        decisionId: decision.id,
        type: 'executionUpdated',
        createdAt: updatedAt,
        references: [decision.proposalReference],
        metadata: {
          status: update.status,
          externalRunId: update.externalRunId,
          executor: update.executor,
        },
      }),
    ],
  })
}

export function updateDecisionOutcome(
  decision: Decision,
  {
    status,
    summary,
    references = [],
    now,
  }: {
    status: DecisionOutcomeStatus
    summary?: string
    references?: DecisionReference[]
    now?: Date
  },
): Decision {
  const updatedAt = timestamp(now)
  const normalized = normalizeReferences(references)
  return touchDecision(decision, updatedAt, {
    outcome: {
      ...decision.outcome,
      status,
      summary,
      references: normalized,
      updatedAt,
    },
    supportingReferences: normalizeReferences([
      ...decision.supportingReferences,
      ...normalized,
    ]),
    timeline: [
      ...decision.timeline,
      timelineEvent({
        decisionId: decision.id,
        type: 'outcomeUpdated',
        createdAt: updatedAt,
        references: normalized,
        metadata: { status, summary },
      }),
    ],
  })
}

export function attachDecisionExplanation(
  decision: Decision,
  explanation: Omit<
    DecisionExplanation,
    'id' | 'createdAt' | 'decisionSource'
  > & {
    id?: string
    now?: Date
  },
): Decision {
  const createdAt = timestamp(explanation.now)
  const nextExplanation: DecisionExplanation = {
    id: explanation.id ?? `decision-explanation:${decision.id}`,
    confidence: explanation.confidence,
    reasons: explanation.reasons,
    warnings: explanation.warnings,
    supportingReferences: normalizeReferences(explanation.supportingReferences),
    decisionSource: decision.source,
    approvalDetails: explanation.approvalDetails,
    executionSummary: explanation.executionSummary,
    createdAt,
  }
  return touchDecision(decision, createdAt, {
    explanation: nextExplanation,
    supportingReferences: normalizeReferences([
      ...decision.supportingReferences,
      ...nextExplanation.supportingReferences,
    ]),
    timeline: [
      ...decision.timeline,
      timelineEvent({
        decisionId: decision.id,
        type: 'explanationAttached',
        createdAt,
        references: nextExplanation.supportingReferences,
      }),
    ],
  })
}

export function closeDecision(
  decision: Decision,
  {
    actor,
    now,
  }: {
    actor?: DecisionActor
    now?: Date
  } = {},
): Decision {
  const updatedAt = timestamp(now)
  return touchDecision(decision, updatedAt, {
    lifecycleStatus: 'closed',
    timeline: [
      ...decision.timeline,
      timelineEvent({
        decisionId: decision.id,
        type: 'closed',
        createdAt: updatedAt,
        actor,
        references: [decision.proposalReference],
      }),
    ],
  })
}

export function filterDecisionsForActor(
  decisions: Decision[],
  actor: DecisionActor,
  workspaceId: string,
): Decision[] {
  const permissionSet = new Set(actor.permissions)
  const canViewAll =
    actor.role === 'OWNER' ||
    actor.role === 'ADMIN' ||
    actor.permissions.includes('decisions:read:all')
  return decisions
    .filter((decision) => decision.workspaceId === workspaceId)
    .filter((decision) => {
      const visibleMembers = decision.visibility.visibleToMemberIds
      if (!canViewAll && visibleMembers?.length) {
        return actor.workspaceMemberId
          ? visibleMembers.includes(actor.workspaceMemberId)
          : false
      }
      return (
        decision.visibility.requiredPermissions.every((permission) =>
          permissionSet.has(permission),
        ) || canViewAll
      )
    })
    .sort(
      (first, second) =>
        first.createdAt.localeCompare(second.createdAt) ||
        first.id.localeCompare(second.id),
    )
}

export function createDecisionReferenceFromKnowledge(
  reference: WorkspaceKnowledgeReference,
): DecisionReference {
  return {
    id: `decision-reference:knowledge:${reference.id}`,
    kind:
      reference.kind === 'snapshot'
        ? 'workspaceSnapshot'
        : 'knowledgeReference',
    label: reference.label,
    providerId: reference.providerId,
    sourceId: reference.id,
  }
}

export function createDecisionReference({
  id,
  kind,
  label,
  providerId,
  sourceId,
  metadata,
}: DecisionReference): DecisionReference {
  return { id, kind, label, providerId, sourceId, metadata }
}

function normalizeDecisionProposal({
  proposal,
  source,
  now,
}: {
  proposal: DecisionProposal | ActionProposal | WorkspaceAISuggestedAction
  source: DecisionSource
  now: string
}): DecisionProposal {
  if ('source' in proposal && 'createdAt' in proposal) {
    return {
      ...proposal,
      references: normalizeReferences(proposal.references),
    }
  }
  return {
    id: proposal.id,
    actionType: proposal.actionType,
    label: proposal.label,
    source,
    targetProviderId: proposal.targetProviderId,
    requiredToolId: proposal.requiredToolId,
    parameters: proposal.parameters,
    confidence: proposal.confidence,
    references: normalizeReferences(
      proposal.references.map(createDecisionReferenceFromKnowledge),
    ),
    createdAt: now,
  }
}

function timelineEvent({
  decisionId,
  type,
  createdAt,
  actor,
  references,
  metadata,
}: {
  decisionId: string
  type: DecisionTimelineEventType
  createdAt: string
  actor?: DecisionActor
  references: DecisionReference[]
  metadata?: Record<string, unknown>
}): DecisionTimelineEvent {
  return {
    id: `decision-timeline:${decisionId}:${type}:${createdAt}`,
    type,
    createdAt,
    actor,
    references: normalizeReferences(references),
    metadata,
  }
}

function touchDecision(
  decision: Decision,
  updatedAt: string,
  patch: Partial<Decision>,
): Decision {
  return {
    ...decision,
    ...patch,
    updatedAt,
  }
}

function normalizeReferences(references: DecisionReference[]) {
  return [
    ...new Map(
      references.map((reference) => [reference.id, reference]),
    ).values(),
  ].sort((first, second) => first.id.localeCompare(second.id))
}

function timestamp(now?: Date) {
  return (now ?? new Date()).toISOString()
}

function withoutNow<T extends { now?: Date }>(value: T): Omit<T, 'now'> {
  const { now: _now, ...rest } = value
  return rest
}

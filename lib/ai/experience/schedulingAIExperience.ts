import {
  WorkspaceAIRuntime,
  type AIRuntimeConfidence,
  type AIRuntimeExecutionMode,
  type AIRuntimeOutputType,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import { SCHEDULING_RECOMMENDATION_PROVENANCE } from '@/lib/ai/playground/recommendationFormatting'
import {
  createWorkspaceAIApproval,
  createWorkspaceAIExperience,
  type WorkspaceAIContextReference,
  type WorkspaceAIConversationRequest,
  type WorkspaceAIReference,
  type WorkspaceAIResponse,
  type WorkspaceAISuggestedAction,
} from '@/lib/ai/experience/workspaceAIExperience'
import {
  DecisionFramework,
  type Decision,
} from '@/lib/decisions/decisionFramework'
import type {
  WorkspaceIntelligenceActor,
  WorkspaceIntelligenceIntent,
  WorkspaceIntelligenceWorkspace,
  WorkspaceKnowledgeReference,
  WorkspaceRecommendationReason,
  WorkspaceRecommendationWarning,
} from '@/lib/intelligence/workspaceIntelligence'
import {
  createSchedulingKnowledgeService,
  normalizeSchedulingConflictFindings,
  type SchedulingAvailabilitySummary,
  type SchedulingConflict,
  type SchedulingKnowledgeInput,
  type SchedulingProviderHealthSnapshot,
  type SchedulingRecommendationCandidate,
  type SchedulingSnapshot,
  type SchedulingWorkloadSummary,
} from '@/lib/scheduling/schedulingKnowledge'
import {
  addDateKeys,
  formatInWorkspaceTimezone,
  getEndOfWorkspaceDay,
  getStartOfWeekDateKey,
  getStartOfWorkspaceDay,
  getWorkspaceDateKey,
  parseSchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'

export type SchedulingAIIntent =
  | 'draftEventProposal'
  | 'explainSchedulingConflict'
  | 'explainRecommendation'
  | 'explainTechnicianAvailability'
  | 'explainWorkload'
  | 'explainAssignment'
  | 'explainRecurringSchedule'
  | 'recommendTechnician'
  | 'recommendTeam'
  | 'recommendLocation'
  | 'recommendAppointmentTime'
  | 'recommendAlternateSchedule'
  | 'recommendReassignment'
  | 'analyzeSchedule'
  | 'analyzeConflicts'
  | 'analyzeWorkload'
  | 'summarizeTodaysSchedule'
  | 'summarizeUpcomingWork'

export type SchedulingAIResponseKind =
  | 'explanation'
  | 'recommendation'
  | 'analysis'
  | 'summary'
  | 'actionProposal'

export type SchedulingAIActionProposalType =
  | 'createEvent'
  | 'createEventAndAssign'
  | 'assignTechnician'
  | 'moveAppointment'
  | 'changeTeam'
  | 'notifyCustomer'
  | 'createTask'
  | 'updateRecurringSchedule'

export type SchedulingAIObjectReference = {
  id: string
  kind:
    | 'event'
    | 'technician'
    | 'team'
    | 'location'
    | 'calendar'
    | 'workspace'
    | 'selection'
  label: string
  referenceId?: string
  metadata?: Record<string, unknown>
}

export type SchedulingAIRequest = {
  id: string
  workspace: WorkspaceIntelligenceWorkspace
  actor: WorkspaceIntelligenceActor
  intent: SchedulingAIIntent
  schedulingSource: SchedulingKnowledgeInput
  currentEvent?: SchedulingAIObjectReference
  currentTechnician?: SchedulingAIObjectReference
  currentTeam?: SchedulingAIObjectReference
  currentLocation?: SchedulingAIObjectReference
  currentCalendar?: SchedulingAIObjectReference
  currentWorkspace?: SchedulingAIObjectReference
  currentSelection?: SchedulingAIObjectReference[]
  requestText?: string
  conversation?: WorkspaceAIConversationRequest
  rangeStart?: Date
  rangeEnd?: Date
  dateKey?: string
  durationMinutes?: number
  includeActionProposal?: boolean
  proposedActionType?: SchedulingAIActionProposalType
  executionMode?: AIRuntimeExecutionMode
  llmProviderId?: string
  now?: Date
}

export type SchedulingAIIntentRoute = {
  intent: SchedulingAIIntent
  workspaceIntent: WorkspaceIntelligenceIntent
  responseKind: SchedulingAIResponseKind
  outputType: AIRuntimeOutputType
  supportedActionTypes: SchedulingAIActionProposalType[]
}

export type SchedulingAIExplanation = {
  id: string
  title: string
  summary: string
  details: string[]
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  references: WorkspaceAIReference[]
}

export type SchedulingAIRecommendation = {
  id: string
  candidateId: string
  candidateType: SchedulingRecommendationCandidate['candidateType']
  label: string
  /**
   * Deterministic Scheduling Knowledge score on an inclusive 0-100 scale.
   */
  score: number
  confidence: SchedulingRecommendationCandidate['confidence']
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  provenance: typeof SCHEDULING_RECOMMENDATION_PROVENANCE & {
    aiProviderGeneratedExplanation: false
  }
  metadata?: Record<string, unknown>
}

export type SchedulingAIConflictResolutionAction =
  | 'REASSIGN'
  | 'RESCHEDULE'
  | 'ESCALATE'
  | 'KEEP_AND_WARN'

export type SchedulingAIConflictDetail = {
  id: string
  title: string
  conflictType: SchedulingConflict['conflictType']
  severity: SchedulingConflict['severity']
  status: 'active' | 'upcoming' | 'past' | 'informational'
  affectedAssigneeLabel?: string
  affectedTeamLabel?: string
  sourceLabel: string
  sourceEventId?: string
  startsAt?: string
  endsAt?: string
  timeRangeLabel?: string
  overlapLabel?: string
  whyItMatters: string
  recommendedAction: SchedulingAIConflictResolutionAction
  recommendedActionLabel: string
  recommendationReason: string
  alternativeActions: Array<{
    action: SchedulingAIConflictResolutionAction
    label: string
    reason: string
  }>
}

export type SchedulingAIAnalysis = {
  id: string
  title: string
  summary: string
  range: {
    mode:
      | 'explicit'
      | 'rightNow'
      | 'today'
      | 'week'
      | 'month'
      | 'restOfMonth'
      | 'currentUpcoming'
      | 'default'
    label: string
    startsAt: string
    endsAt: string
  }
  conflictCounts: {
    total: number
    blocking: number
    informational: number
  }
  conflicts: SchedulingConflict[]
  conflictDetails: SchedulingAIConflictDetail[]
  workload: SchedulingWorkloadSummary[]
  providerHealth: SchedulingProviderHealthSnapshot[]
  snapshot?: SchedulingSnapshot
}

export type SchedulingAISummary = {
  id: string
  title: string
  summary: string
  items: Array<{
    id: string
    label: string
    startsAt?: string
    endsAt?: string
    status?: string
  }>
}

export type SchedulingAIRenderingMetadata = {
  cards: Array<
    | 'recommendationCard'
    | 'conflictCard'
    | 'explanationCard'
    | 'summaryCard'
    | 'actionProposalCard'
  >
  primaryCard:
    | 'recommendationCard'
    | 'conflictCard'
    | 'explanationCard'
    | 'summaryCard'
    | 'actionProposalCard'
  layout: 'single' | 'stacked' | 'review'
  referenceIds: string[]
}

export type SchedulingAIResponse = {
  id: string
  intent: SchedulingAIIntent
  routedIntent: WorkspaceIntelligenceIntent
  responseKind: SchedulingAIResponseKind
  confidence: AIRuntimeConfidence
  explanations: SchedulingAIExplanation[]
  recommendations: SchedulingAIRecommendation[]
  analysis?: SchedulingAIAnalysis
  summary?: SchedulingAISummary
  actionProposals: WorkspaceAISuggestedAction[]
  decisionProposals: Decision[]
  warnings: WorkspaceAIResponse['warnings']
  references: WorkspaceAIReference[]
  rendering: SchedulingAIRenderingMetadata
  workspaceAIResponse: WorkspaceAIResponse
}

const schedulingAIIntentRoutes: Record<
  SchedulingAIIntent,
  SchedulingAIIntentRoute
> = {
  draftEventProposal: route(
    'scheduling.findBestMember',
    'actionProposal',
    'actionProposals',
    ['createEvent', 'createEventAndAssign'],
  ),
  explainSchedulingConflict: route(
    'scheduling.explainConflict',
    'explanation',
    'explanation',
  ),
  explainRecommendation: route(
    'scheduling.explainAssignment',
    'explanation',
    'explanation',
  ),
  explainTechnicianAvailability: route(
    'scheduling.explainUnavailable',
    'explanation',
    'explanation',
  ),
  explainWorkload: route(
    'scheduling.balanceWorkload',
    'explanation',
    'explanation',
  ),
  explainAssignment: route(
    'scheduling.explainAssignment',
    'explanation',
    'explanation',
  ),
  explainRecurringSchedule: route(
    'scheduling.findRecurringSlot',
    'explanation',
    'explanation',
  ),
  recommendTechnician: route(
    'scheduling.findBestMember',
    'recommendation',
    'recommendations',
    ['assignTechnician'],
  ),
  recommendTeam: route(
    'scheduling.findBestTeam',
    'recommendation',
    'recommendations',
    ['changeTeam'],
  ),
  recommendLocation: route(
    'scheduling.findBestMember',
    'recommendation',
    'recommendations',
  ),
  recommendAppointmentTime: route(
    'scheduling.findAvailableSlot',
    'recommendation',
    'recommendations',
    ['moveAppointment'],
  ),
  recommendAlternateSchedule: route(
    'scheduling.rescheduleAppointment',
    'recommendation',
    'recommendations',
    ['moveAppointment'],
  ),
  recommendReassignment: route(
    'scheduling.assignEvent',
    'recommendation',
    'recommendations',
    ['assignTechnician'],
  ),
  analyzeSchedule: route('scheduling.balanceWorkload', 'analysis', 'analysis'),
  analyzeConflicts: route('scheduling.explainConflict', 'analysis', 'analysis'),
  analyzeWorkload: route('scheduling.balanceWorkload', 'analysis', 'analysis'),
  summarizeTodaysSchedule: route(
    'scheduling.balanceWorkload',
    'summary',
    'summary',
  ),
  summarizeUpcomingWork: route(
    'scheduling.balanceWorkload',
    'summary',
    'summary',
  ),
}

export function routeSchedulingAIIntent(
  intent: SchedulingAIIntent,
): SchedulingAIIntentRoute {
  return { ...schedulingAIIntentRoutes[intent], intent }
}

export async function runSchedulingAIRequest({
  request,
  runtime = new WorkspaceAIRuntime(),
  decisionFramework = new DecisionFramework(),
}: {
  request: SchedulingAIRequest
  runtime?: WorkspaceAIRuntime
  decisionFramework?: DecisionFramework
}): Promise<SchedulingAIResponse> {
  const routed = routeSchedulingAIIntent(request.intent)
  const contextReferences = toWorkspaceAIContextReferences(request)
  const workspaceAI = createWorkspaceAIExperience()
  const canReadScheduling = canUseSchedulingAI(request.actor)
  const now = request.now ?? request.schedulingSource.now ?? new Date()
  const session = workspaceAI.createSession({
    id: `scheduling-ai-session:${request.id}`,
    workspace: request.workspace,
    actor: request.actor,
    entryPointId: 'scheduling',
    intent: routed.workspaceIntent,
    contextReferences,
    conversation: request.conversation?.metadata,
    now,
  })
  const workspaceAIResponse = await workspaceAI.runRequest({
    request: {
      id: `scheduling-ai:${request.id}`,
      session,
      requestedIntent: routed.workspaceIntent,
      requestedOutputType: routed.outputType,
      contextReferences,
      providerSources: canReadScheduling
        ? { scheduling: request.schedulingSource }
        : {},
      requestText: request.requestText,
      conversation: request.conversation,
      allowedActionTypes: [
        ...routed.supportedActionTypes,
        ...(request.proposedActionType ? [request.proposedActionType] : []),
      ],
      executionMode: request.executionMode,
      llmProviderId: request.llmProviderId,
      now,
    },
    runtime,
  })

  const permissionWarnings = canReadScheduling
    ? []
    : [
        {
          code: 'scheduling-permission-required',
          message:
            'Scheduling AI requires workspace:read and scheduling:read permissions.',
          severity: 'blocking' as const,
        },
      ]
  const deterministic = canReadScheduling
    ? buildDeterministicSchedulingOutput({
        request,
        routed,
        workspaceAIResponse,
        now,
      })
    : emptyDeterministicOutput()
  const actionProposals = buildActionProposals({
    request,
    routed,
    recommendations: deterministic.recommendations,
    references: workspaceAIResponse.runtimeResponse.knowledgeReferences,
  })
  const decisionProposals = actionProposals.map((proposal) =>
    decisionFramework.receiveProposal({
      id: `decision:${proposal.id}`,
      workspaceId: request.workspace.id,
      source: {
        type: 'workspaceAI',
        id: workspaceAIResponse.id,
        label: 'Scheduling AI',
      },
      actor: request.actor,
      intent: routed.workspaceIntent,
      providerId: 'scheduling',
      proposal,
      reasons: deterministic.recommendations[0]?.reasons ?? [],
      warnings: deterministic.recommendations[0]?.warnings ?? [],
      visibility: {
        workspaceId: request.workspace.id,
        requiredPermissions: ['scheduling:read'],
      },
      approval: {
        requiredPermissions: ['scheduling:write'],
      },
      metadata: {
        schedulingAIIntent: request.intent,
        executionBoundary: 'proposal-only',
      },
      now,
    }),
  )

  return {
    id: `scheduling-ai-response:${request.id}`,
    intent: request.intent,
    routedIntent: routed.workspaceIntent,
    responseKind:
      actionProposals.length > 0 ? 'actionProposal' : routed.responseKind,
    confidence: highestConfidence([
      workspaceAIResponse.confidence,
      ...deterministic.recommendations.map((item) => item.confidence),
    ]),
    explanations: deterministic.explanations,
    recommendations: deterministic.recommendations,
    analysis: deterministic.analysis,
    summary: deterministic.summary,
    actionProposals,
    decisionProposals,
    warnings: [...permissionWarnings, ...workspaceAIResponse.warnings],
    references: workspaceAIResponse.references,
    rendering: getSchedulingAIResponseRendering({
      route: routed,
      references: workspaceAIResponse.references,
      hasActions: actionProposals.length > 0,
      hasConflicts: Boolean(deterministic.analysis?.conflicts.length),
    }),
    workspaceAIResponse,
  }
}

function buildDeterministicSchedulingOutput({
  request,
  routed,
  workspaceAIResponse,
  now,
}: {
  request: SchedulingAIRequest
  routed: SchedulingAIIntentRoute
  workspaceAIResponse: WorkspaceAIResponse
  now: Date
}) {
  const service = createSchedulingKnowledgeService({
    ...request.schedulingSource,
    now,
  })
  const analysisRange = resolveSchedulingAIAnalysisRange({ request, now })
  const { rangeStart, rangeEnd } = analysisRange
  const recommendations = buildRecommendations({
    request,
    routed,
    service,
    rangeStart,
    rangeEnd,
  })
  const analysis =
    routed.responseKind === 'analysis'
      ? buildAnalysis({ request, service, range: analysisRange, now })
      : undefined
  const summary =
    routed.responseKind === 'summary'
      ? buildSummary({ request, service, now })
      : undefined
  const explanations =
    routed.responseKind === 'explanation'
      ? buildExplanations({
          request,
          service,
          recommendations,
          references: workspaceAIResponse.references,
          rangeStart,
          rangeEnd,
        })
      : []

  return {
    recommendations,
    explanations,
    analysis,
    summary,
  }
}

type SchedulingAIResolvedAnalysisRange = {
  mode: SchedulingAIAnalysis['range']['mode']
  label: string
  rangeStart: Date
  rangeEnd: Date
}

function resolveSchedulingAIAnalysisRange({
  request,
  now,
}: {
  request: SchedulingAIRequest
  now: Date
}): SchedulingAIResolvedAnalysisRange {
  const timezone =
    request.workspace.timezone ||
    request.schedulingSource.workspace.timezone ||
    'UTC'
  const text = (request.requestText ?? '').toLowerCase()

  if (request.rangeStart && request.rangeEnd) {
    return {
      mode: 'explicit',
      label: formatSchedulingAIRangeLabel(
        request.rangeStart,
        request.rangeEnd,
        timezone,
      ),
      rangeStart: request.rangeStart,
      rangeEnd: request.rangeEnd,
    }
  }

  const todayKey = getWorkspaceDateKey(now, timezone)

  if (
    /\b(right now|at this moment|currently happening|happening now)\b/.test(
      text,
    )
  ) {
    return {
      mode: 'rightNow',
      label: 'right now',
      rangeStart: now,
      rangeEnd: new Date(now.getTime() + 60_000),
    }
  }

  if (/\b(today|current day)\b/.test(text)) {
    const rangeStart = getStartOfWorkspaceDay(todayKey, timezone)
    const rangeEnd = getEndOfWorkspaceDay(todayKey, timezone)
    return {
      mode: 'today',
      label: 'today',
      rangeStart,
      rangeEnd,
    }
  }

  if (/\b(this week|current week|week ahead)\b/.test(text)) {
    const weekStartsOn = request.schedulingSource.settings.weekStartsOn ?? 1
    const startKey = getStartOfWeekDateKey(todayKey, weekStartsOn)
    const endKey = addDateKeys(startKey, 6)
    return {
      mode: 'week',
      label: 'this week',
      rangeStart: getStartOfWorkspaceDay(startKey, timezone),
      rangeEnd: getEndOfWorkspaceDay(endKey, timezone),
    }
  }

  if (/\b(rest of (the )?month|remaining month)\b/.test(text)) {
    const monthEndKey = getMonthEndDateKey(todayKey)
    return {
      mode: 'restOfMonth',
      label: 'the rest of this month',
      rangeStart: now,
      rangeEnd: getEndOfWorkspaceDay(monthEndKey, timezone),
    }
  }

  if (/\b(this month|current month)\b/.test(text)) {
    const { year, month } = parseSchedulingDateKey(todayKey)
    const startKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
    const endKey = getMonthEndDateKey(todayKey)
    return {
      mode: 'month',
      label: 'this month',
      rangeStart: getStartOfWorkspaceDay(startKey, timezone),
      rangeEnd: getEndOfWorkspaceDay(endKey, timezone),
    }
  }

  if (
    request.intent === 'analyzeConflicts' ||
    request.intent === 'explainSchedulingConflict' ||
    /\b(current conflicts|active conflicts|upcoming conflicts|who is unavailable)\b/.test(
      text,
    )
  ) {
    return {
      mode: 'currentUpcoming',
      label: 'current and upcoming scheduling conflicts for the next 30 days',
      rangeStart: now,
      rangeEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    }
  }

  return {
    mode: 'default',
    label: 'the selected scheduling window',
    rangeStart: request.rangeStart ?? now,
    rangeEnd: request.rangeEnd ?? new Date(now.getTime() + 60 * 60_000),
  }
}

function getMonthEndDateKey(dateKey: string) {
  const { year, month } = parseSchedulingDateKey(dateKey)
  const monthEnd = new Date(Date.UTC(year, month, 0, 12, 0, 0, 0))
  return `${String(monthEnd.getUTCFullYear()).padStart(4, '0')}-${String(monthEnd.getUTCMonth() + 1).padStart(2, '0')}-${String(monthEnd.getUTCDate()).padStart(2, '0')}`
}

function formatSchedulingAIRangeLabel(
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string,
) {
  const date = (value: Date) =>
    formatInWorkspaceTimezone(value, timezone, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  const startDate = date(rangeStart)
  const endDate = date(rangeEnd)
  if (startDate === endDate) return startDate
  return `${startDate} through ${endDate}`
}

function buildRecommendations({
  request,
  routed,
  service,
  rangeStart,
  rangeEnd,
}: {
  request: SchedulingAIRequest
  routed: SchedulingAIIntentRoute
  service: ReturnType<typeof createSchedulingKnowledgeService>
  rangeStart: Date
  rangeEnd: Date
}): SchedulingAIRecommendation[] {
  const memberId =
    request.currentTechnician?.referenceId ?? request.currentTechnician?.id
  const eventId = request.currentEvent?.referenceId ?? request.currentEvent?.id
  const dateKey =
    request.dateKey ??
    getWorkspaceDateKey(rangeStart, request.workspace.timezone)
  const durationMinutes = request.durationMinutes ?? 60
  let candidates: SchedulingRecommendationCandidate[] = []

  if (
    request.intent === 'recommendTechnician' ||
    request.intent === 'draftEventProposal'
  ) {
    candidates = service.recommendMembers({
      rangeStart,
      rangeEnd,
      locationId:
        request.currentLocation?.referenceId ?? request.currentLocation?.id,
    })
  } else if (request.intent === 'recommendTeam') {
    candidates = service.recommendTeams({ rangeStart, rangeEnd })
  } else if (request.intent === 'recommendLocation') {
    candidates = service.recommendLocations({ rangeStart, rangeEnd })
  } else if (request.intent === 'recommendAppointmentTime' && memberId) {
    candidates = service.recommendTimeSlots({
      memberId,
      dateKey,
      durationMinutes,
    })
  } else if (request.intent === 'recommendAlternateSchedule' && memberId) {
    candidates = service.recommendTimeSlots({
      memberId,
      dateKey,
      durationMinutes,
    })
  } else if (request.intent === 'recommendReassignment' && eventId) {
    candidates = service.recommendReassignmentCandidates({
      eventId,
    }) as SchedulingRecommendationCandidate[]
  } else if (routed.workspaceIntent === 'scheduling.findBestMember') {
    candidates = service.recommendMembers({ rangeStart, rangeEnd })
  }

  return candidates.map(toSchedulingAIRecommendation)
}

function buildExplanations({
  request,
  service,
  recommendations,
  references,
  rangeStart,
  rangeEnd,
}: {
  request: SchedulingAIRequest
  service: ReturnType<typeof createSchedulingKnowledgeService>
  recommendations: SchedulingAIRecommendation[]
  references: WorkspaceAIReference[]
  rangeStart: Date
  rangeEnd: Date
}): SchedulingAIExplanation[] {
  if (request.intent === 'explainTechnicianAvailability') {
    const memberId =
      request.currentTechnician?.referenceId ?? request.currentTechnician?.id
    const availability = memberId
      ? service.getMemberAvailability({ memberId, rangeStart, rangeEnd })
      : null
    return [
      availabilityExplanation({
        title: 'Technician availability',
        availability,
        references,
      }),
    ]
  }
  if (request.intent === 'explainSchedulingConflict') {
    const conflicts = service.getSchedulingConflicts({
      memberIds: request.currentTechnician
        ? [
            request.currentTechnician.referenceId ??
              request.currentTechnician.id,
          ]
        : undefined,
      teamIds: request.currentTeam
        ? [request.currentTeam.referenceId ?? request.currentTeam.id]
        : undefined,
      rangeStart,
      rangeEnd,
    })
    return [conflictExplanation({ conflicts, references })]
  }
  if (request.intent === 'explainWorkload') {
    const workload = service.getCurrentWorkload({ rangeStart, rangeEnd })
    return [workloadExplanation({ workload, references })]
  }
  if (request.intent === 'explainRecurringSchedule') {
    const recurring = service.getRecurringSchedule()
    return [
      {
        id: 'scheduling-ai-explanation:recurring-schedule',
        title: 'Recurring schedule',
        summary: recurring.length
          ? `${recurring.length} recurring schedule ${recurring.length === 1 ? 'series is' : 'series are'} visible.`
          : 'No recurring schedule series are visible in this workspace context.',
        details: recurring
          .slice(0, 5)
          .map((item) => `${item.title} · next ${item.nextOccurrenceAt}`),
        reasons: [],
        warnings: [],
        references,
      },
    ]
  }

  return recommendations.length
    ? recommendations.map((recommendation) =>
        recommendationExplanation({ recommendation, references }),
      )
    : [
        {
          id: `scheduling-ai-explanation:${request.intent}`,
          title: 'Scheduling explanation',
          summary:
            'Scheduling AI prepared the deterministic workspace context for this explanation.',
          details: [],
          reasons: [],
          warnings: [],
          references,
        },
      ]
}

function buildAnalysis({
  request,
  service,
  range,
  now,
}: {
  request: SchedulingAIRequest
  service: ReturnType<typeof createSchedulingKnowledgeService>
  range: SchedulingAIResolvedAnalysisRange
  now: Date
}): SchedulingAIAnalysis {
  const conflicts =
    request.intent === 'analyzeWorkload'
      ? []
      : service.getSchedulingConflicts({
          rangeStart: range.rangeStart,
          rangeEnd: range.rangeEnd,
        })
  const normalizedConflicts = normalizeSchedulingConflictFindings(conflicts)
  const blockingConflicts = normalizedConflicts.filter(
    (conflict) => conflict.blocking,
  )
  const conflictDetails = buildSchedulingAIConflictDetails({
    conflicts: normalizedConflicts,
    request,
    service,
    now,
  })
  const workload =
    request.intent === 'analyzeConflicts'
      ? []
      : service.getCurrentWorkload({
          rangeStart: range.rangeStart,
          rangeEnd: range.rangeEnd,
        })
  const providerHealth = service.getProviderHealth()
  const snapshot = service.getSchedulingSnapshot({
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
  })
  const conflictText =
    blockingConflicts.length === 1
      ? '1 active blocking conflict'
      : `${blockingConflicts.length} active blocking conflicts`
  const workloadText =
    workload.length === 1 ? '1 assignee' : `${workload.length} assignees`
  return {
    id: `scheduling-ai-analysis:${request.intent}`,
    title: analysisTitle(request.intent),
    summary: `${conflictText}, ${workloadText}, and ${providerHealth.length} calendar provider health record${providerHealth.length === 1 ? '' : 's'} were analyzed for ${range.label}.`,
    range: {
      mode: range.mode,
      label: range.label,
      startsAt: range.rangeStart.toISOString(),
      endsAt: range.rangeEnd.toISOString(),
    },
    conflictCounts: {
      total: normalizedConflicts.length,
      blocking: blockingConflicts.length,
      informational: normalizedConflicts.length - blockingConflicts.length,
    },
    conflicts: normalizedConflicts,
    conflictDetails,
    workload,
    providerHealth,
    snapshot,
  }
}

function buildSchedulingAIConflictDetails({
  conflicts,
  request,
  service,
  now,
}: {
  conflicts: SchedulingConflict[]
  request: SchedulingAIRequest
  service: ReturnType<typeof createSchedulingKnowledgeService>
  now: Date
}): SchedulingAIConflictDetail[] {
  const context = service.getSchedulingContext()
  const timezone =
    context.workspace.timezone || request.workspace.timezone || 'UTC'
  const membersById = new Map(
    context.members.map((member) => [member.id, member]),
  )
  const teamsById = new Map(context.teams.map((team) => [team.id, team]))
  const eventsById = new Map(context.events.map((event) => [event.id, event]))
  const emergencyRequest = /\b(emergency|urgent|asap|same[- ]?day)\b/i.test(
    request.requestText ?? '',
  )

  return conflicts.map((conflict) => {
    const sourceEvent =
      conflict.conflictType === 'busy'
        ? eventsById.get(conflict.sourceId)
        : undefined
    const assignedMemberId =
      conflict.memberId ??
      sourceEvent?.assignedMemberIds.find((id) => membersById.has(id))
    const assignedTeamId =
      conflict.teamId ??
      sourceEvent?.assignedMemberIds.find((id) => teamsById.has(id))
    const affectedAssigneeLabel = assignedMemberId
      ? membersById.get(assignedMemberId)?.label
      : undefined
    const affectedTeamLabel = assignedTeamId
      ? teamsById.get(assignedTeamId)?.label
      : undefined
    const resolution = rankSchedulingAIConflictResolution({
      conflict,
      sourceEventId: sourceEvent?.id,
      service,
      emergencyRequest:
        emergencyRequest ||
        /\b(emergency|urgent|asap)\b/i.test(sourceEvent?.title ?? ''),
    })
    return {
      id: `scheduling-ai-conflict-detail:${conflict.id}`,
      title: schedulingAIConflictTitle(conflict),
      conflictType: conflict.conflictType,
      severity: conflict.severity,
      status: schedulingAIConflictStatus(conflict, now),
      affectedAssigneeLabel,
      affectedTeamLabel,
      sourceLabel: conflict.sourceLabel,
      sourceEventId: sourceEvent?.id,
      startsAt: conflict.startsAt,
      endsAt: conflict.endsAt,
      timeRangeLabel: formatSchedulingAIConflictTimeRange({
        startsAt: conflict.startsAt,
        endsAt: conflict.endsAt,
        timezone,
      }),
      overlapLabel: formatSchedulingAIConflictOverlap(conflict, timezone),
      whyItMatters: schedulingAIConflictImpact(conflict),
      recommendedAction: resolution.recommendedAction,
      recommendedActionLabel: resolution.recommendedActionLabel,
      recommendationReason: resolution.recommendationReason,
      alternativeActions: resolution.alternativeActions,
    }
  })
}

function rankSchedulingAIConflictResolution({
  conflict,
  sourceEventId,
  service,
  emergencyRequest,
}: {
  conflict: SchedulingConflict
  sourceEventId?: string
  service: ReturnType<typeof createSchedulingKnowledgeService>
  emergencyRequest: boolean
}): Pick<
  SchedulingAIConflictDetail,
  | 'recommendedAction'
  | 'recommendedActionLabel'
  | 'recommendationReason'
  | 'alternativeActions'
> {
  const reassignmentCandidate = sourceEventId
    ? service
        .recommendReassignmentCandidates({ eventId: sourceEventId })
        .find((candidate) =>
          isViableSchedulingAIReassignment(candidate, emergencyRequest),
        )
    : undefined

  if (reassignmentCandidate) {
    return {
      recommendedAction: 'REASSIGN',
      recommendedActionLabel: `Reassign to ${reassignmentCandidate.label}`,
      recommendationReason: emergencyRequest
        ? `${reassignmentCandidate.label} is the strongest available qualified candidate. Emergency priority does not override time off, overlapping work, or blocking availability conflicts.`
        : `${reassignmentCandidate.label} is available based on deterministic workload and availability evidence.`,
      alternativeActions: [
        {
          action: 'RESCHEDULE',
          label: 'Reschedule',
          reason: 'Use if reassignment is not operationally acceptable.',
        },
        {
          action: 'ESCALATE',
          label: 'Escalate',
          reason:
            'Use if the customer impact or staffing risk needs manager review.',
        },
      ],
    }
  }

  if (!conflict.blocking && conflict.severity !== 'blocking') {
    return {
      recommendedAction: 'KEEP_AND_WARN',
      recommendedActionLabel: 'Keep scheduled with warning',
      recommendationReason:
        'The conflict is informational or advisory, so no automatic schedule change is required.',
      alternativeActions: [
        {
          action: 'ESCALATE',
          label: 'Escalate',
          reason:
            'Use if this advisory condition should become a hard workspace rule.',
        },
      ],
    }
  }

  if (
    conflict.conflictType === 'timeOff' ||
    conflict.conflictType === 'externalAvailability'
  ) {
    return {
      recommendedAction: 'RESCHEDULE',
      recommendedActionLabel: 'Reschedule around unavailable time',
      recommendationReason:
        'Time off and external busy time are treated as blocking availability constraints.',
      alternativeActions: [
        {
          action: 'ESCALATE',
          label: 'Escalate',
          reason: 'Use if a manager needs to approve an exception.',
        },
      ],
    }
  }

  return {
    recommendedAction: 'RESCHEDULE',
    recommendedActionLabel: 'Reschedule or find another assignee',
    recommendationReason:
      'No conflict-free reassignment candidate was found in the deterministic scheduling context.',
    alternativeActions: [
      {
        action: 'ESCALATE',
        label: 'Escalate',
        reason:
          'Use if the current commitment should be kept despite this conflict.',
      },
    ],
  }
}

function isViableSchedulingAIReassignment(
  candidate: Pick<
    SchedulingRecommendationCandidate,
    'candidateType' | 'score'
  > & {
    warnings: Array<{ code: string; severity?: string }>
  },
  emergencyRequest: boolean,
) {
  if (candidate.candidateType !== 'member') return false
  const blockingWarnings = candidate.warnings.filter(
    (warning) => warning.severity === 'blocking',
  )
  if (blockingWarnings.length) return false
  const hardWarningCodes = new Set([
    'busy-conflict',
    'time-off',
    'availability-exception',
    'external-availability-conflict',
  ])
  if (
    candidate.warnings.some((warning) => hardWarningCodes.has(warning.code))
  ) {
    return false
  }
  if (
    !emergencyRequest &&
    candidate.warnings.some(
      (warning) => warning.code === 'outside-working-hours',
    )
  ) {
    return false
  }
  return candidate.score >= 50
}

function schedulingAIConflictStatus(
  conflict: SchedulingConflict,
  now: Date,
): SchedulingAIConflictDetail['status'] {
  if (!conflict.blocking && conflict.severity !== 'blocking')
    return 'informational'
  const startsAt = conflict.startsAt ? new Date(conflict.startsAt) : null
  const endsAt = conflict.endsAt ? new Date(conflict.endsAt) : null
  if (startsAt && endsAt && startsAt <= now && endsAt >= now) return 'active'
  if (startsAt && startsAt > now) return 'upcoming'
  if (endsAt && endsAt < now) return 'past'
  return 'upcoming'
}

function schedulingAIConflictTitle(conflict: SchedulingConflict) {
  if (conflict.conflictType === 'busy') return 'Overlapping scheduled work'
  if (conflict.conflictType === 'timeOff') return 'Time off conflict'
  if (conflict.conflictType === 'availabilityException')
    return 'Availability exception'
  if (conflict.conflictType === 'externalAvailability')
    return 'External calendar conflict'
  return 'Outside working hours'
}

function schedulingAIConflictImpact(conflict: SchedulingConflict) {
  if (conflict.conflictType === 'outsideWorkingHours') {
    return 'The requested time is outside the configured working-hours policy.'
  }
  if (conflict.conflictType === 'availabilityException') {
    return 'The requested window overlaps an availability exception for the workspace, team, or member.'
  }
  if (conflict.conflictType === 'timeOff') {
    return 'The assigned person or team is unavailable during this window.'
  }
  if (conflict.conflictType === 'externalAvailability') {
    return 'A connected calendar indicates unavailable time during this window.'
  }
  return 'The assigned person or team already has blocking scheduled work during this window.'
}

function formatSchedulingAIConflictTimeRange({
  startsAt,
  endsAt,
  timezone,
}: {
  startsAt?: string
  endsAt?: string
  timezone: string
}) {
  if (!startsAt && !endsAt) return undefined
  const start = startsAt ? new Date(startsAt) : null
  const end = endsAt ? new Date(endsAt) : null
  const dateFormat: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  if (start && end) {
    const startDate = formatInWorkspaceTimezone(start, timezone, dateFormat)
    const endDate = formatInWorkspaceTimezone(end, timezone, dateFormat)
    const startTime = formatInWorkspaceTimezone(start, timezone, timeFormat)
    const endTime = formatInWorkspaceTimezone(end, timezone, timeFormat)
    return startDate === endDate
      ? `${startDate} · ${startTime}-${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`
  }
  const value = start ?? end
  if (!value) return undefined
  return formatInWorkspaceTimezone(value, timezone, {
    ...dateFormat,
    ...timeFormat,
  })
}

function formatSchedulingAIConflictOverlap(
  conflict: SchedulingConflict,
  timezone: string,
) {
  const range = formatSchedulingAIConflictTimeRange({
    startsAt: conflict.startsAt,
    endsAt: conflict.endsAt,
    timezone,
  })
  if (!range) return undefined
  return `${conflict.sourceLabel} overlaps ${range}.`
}

function buildSummary({
  request,
  service,
  now,
}: {
  request: SchedulingAIRequest
  service: ReturnType<typeof createSchedulingKnowledgeService>
  now: Date
}): SchedulingAISummary {
  const timezone =
    request.workspace.timezone ||
    request.schedulingSource.workspace.timezone ||
    'UTC'
  const today = getWorkspaceDateKey(now, timezone)
  const rangeStart =
    request.intent === 'summarizeTodaysSchedule'
      ? getStartOfWorkspaceDay(today, timezone)
      : now
  const rangeEnd =
    request.intent === 'summarizeTodaysSchedule'
      ? getEndOfWorkspaceDay(today, timezone)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const assignments =
    request.intent === 'summarizeTodaysSchedule'
      ? service.getTodayAssignments()
      : service.getUpcomingAssignments({ rangeStart, rangeEnd })
  return {
    id: `scheduling-ai-summary:${request.intent}`,
    title:
      request.intent === 'summarizeTodaysSchedule'
        ? "Today's schedule"
        : 'Upcoming work',
    summary: assignments.length
      ? `${assignments.length} scheduled assignment${assignments.length === 1 ? '' : 's'} found.`
      : 'No scheduled assignments found for this range.',
    items: assignments.slice(0, 10).map((item) => ({
      id: item.occurrenceId,
      label: item.title,
      startsAt: item.occurrenceStartsAt,
      endsAt: item.occurrenceEndsAt,
      status: item.status,
    })),
  }
}

function buildActionProposals({
  request,
  routed,
  recommendations,
  references,
}: {
  request: SchedulingAIRequest
  routed: SchedulingAIIntentRoute
  recommendations: SchedulingAIRecommendation[]
  references: WorkspaceKnowledgeReference[]
}): WorkspaceAISuggestedAction[] {
  if (!request.includeActionProposal && !request.proposedActionType) return []
  const compoundPlan = planSchedulingOperations(request)
  const actionType =
    request.proposedActionType ??
    compoundPlan.preferredActionType ??
    routed.supportedActionTypes[0]
  if (!actionType) return []
  const candidate = recommendations[0]
  const proposalId = `scheduling-ai-proposal:${request.id}:${actionType}`
  const eventId = request.currentEvent?.referenceId ?? request.currentEvent?.id
  const eventLabel = request.currentEvent?.label
  const draftEvent = buildDraftEventProposal({
    request,
    candidate,
    compoundPlan,
  })
  const missingFields = proposalMissingFields({
    actionType,
    eventId,
    eventLabel,
    candidate,
    draftEvent,
  })
  const isValid = missingFields.length === 0
  const label = isValid
    ? actionLabel({
        actionType,
        candidate,
        targetLabel: eventLabel,
        draftEvent,
      })
    : 'Proposal unavailable'
  return [
    {
      id: proposalId,
      actionType,
      label,
      summary: isValid
        ? proposalSummary({ actionType, candidate, eventLabel })
        : 'The runtime identified a possible action but did not have enough validated information to form an executable proposal preview.',
      targetProviderId: 'scheduling',
      target: draftEvent
        ? {
            recordType: 'schedulingEventDraft',
            recordId: draftEvent.id,
            label: draftEvent.title,
            detail: draftEvent.startsAt,
          }
        : eventId && eventLabel
          ? {
              recordType: 'schedulingEvent',
              recordId: eventId,
              label: eventLabel,
              detail: request.currentEvent?.metadata?.startsAt
                ? String(request.currentEvent.metadata.startsAt)
                : undefined,
            }
          : undefined,
      currentState: draftEvent
        ? 'No event exists yet. This is an editable draft only.'
        : proposalCurrentState({ actionType, request }),
      proposedState: isValid
        ? proposalProposedState({ actionType, candidate, draftEvent })
        : undefined,
      reasonCodes: candidate?.reasons.map((reason) => reason.code) ?? [],
      explanation: isValid
        ? proposalExplanation({ actionType, candidate })
        : 'Validated target details are required before this can become a reviewable proposal.',
      expectedImpact: isValid ? proposalExpectedImpact({ actionType }) : [],
      warnings: [
        ...(candidate?.warnings.map((warning) => warning.label) ?? []),
        ...(!isValid ? [`Missing: ${missingFields.join(', ')}`] : []),
      ],
      validation: {
        status: isValid ? 'valid' : 'incomplete',
        missingFields,
        message: isValid
          ? 'Ready for internal proposal review. Execution remains disabled.'
          : 'Proposal unavailable until the missing validated context is supplied.',
      },
      parameters: actionParameters({
        request,
        candidate,
        draftEvent,
        compoundPlan,
      }),
      confidence: candidate?.confidence ?? 'medium',
      references,
      approval: createWorkspaceAIApproval({
        actionProposalId: proposalId,
        requiredPermission: 'scheduling:write',
      }),
      executionBoundary: 'proposal-only',
    },
  ]
}

type SchedulingCompoundOperation =
  | 'create'
  | 'schedule'
  | 'move'
  | 'reschedule'
  | 'assign'
  | 'reassign'
  | 'cancel'
  | 'duplicate'
  | 'convert'
  | 'notify'

type SchedulingCompoundPlan = {
  operations: SchedulingCompoundOperation[]
  preferredActionType?: SchedulingAIActionProposalType
  requiresDraftEvent: boolean
  requiresApproval: true
}

type SchedulingDraftEventProposal = {
  id: string
  title: string
  startsAt?: string
  endsAt?: string
  timezone: string
  durationMinutes: number
  assignedMemberId?: string
  assignedMemberLabel?: string
  priority?: string
  tags: string[]
  notes?: string
}

function planSchedulingOperations(
  request: SchedulingAIRequest,
): SchedulingCompoundPlan {
  const text = (request.requestText ?? '').toLowerCase()
  const operations = new Set<SchedulingCompoundOperation>()
  if (/\b(create|book|schedule|set up)\b/.test(text)) {
    operations.add('create')
    operations.add('schedule')
  }
  if (/\b(move|change time)\b/.test(text)) operations.add('move')
  if (/\breschedule\b/.test(text)) operations.add('reschedule')
  if (
    /\b(assign|technician|member|who should|best tech|best technician)\b/.test(
      text,
    )
  ) {
    operations.add('assign')
  }
  if (/\breassign\b/.test(text)) operations.add('reassign')
  if (/\bcancel\b/.test(text)) operations.add('cancel')
  if (/\bduplicate|copy\b/.test(text)) operations.add('duplicate')
  if (/\bconvert\b/.test(text)) operations.add('convert')
  if (/\bnotify|remind|send\b/.test(text)) operations.add('notify')

  const ordered = [
    'create',
    'schedule',
    'move',
    'reschedule',
    'assign',
    'reassign',
    'cancel',
    'duplicate',
    'convert',
    'notify',
  ].filter((operation) =>
    operations.has(operation as SchedulingCompoundOperation),
  ) as SchedulingCompoundOperation[]
  const requiresDraftEvent =
    ordered.includes('create') || request.intent === 'draftEventProposal'
  const preferredActionType: SchedulingAIActionProposalType | undefined =
    requiresDraftEvent && ordered.includes('assign')
      ? 'createEventAndAssign'
      : requiresDraftEvent
        ? 'createEvent'
        : ordered.includes('notify')
          ? 'notifyCustomer'
          : undefined

  return {
    operations: ordered,
    preferredActionType,
    requiresDraftEvent,
    requiresApproval: true,
  }
}

function buildDraftEventProposal({
  request,
  candidate,
  compoundPlan,
}: {
  request: SchedulingAIRequest
  candidate?: SchedulingAIRecommendation
  compoundPlan: SchedulingCompoundPlan
}): SchedulingDraftEventProposal | undefined {
  if (!compoundPlan.requiresDraftEvent) return undefined
  const timezone =
    request.workspace.timezone ||
    request.schedulingSource.workspace.timezone ||
    'UTC'
  const durationMinutes = request.durationMinutes ?? 60
  const startsAt = request.rangeStart?.toISOString()
  const endsAt = startsAt
    ? new Date(
        new Date(startsAt).getTime() + durationMinutes * 60_000,
      ).toISOString()
    : request.rangeEnd?.toISOString()
  return {
    id: `scheduling-event-draft:${request.id}`,
    title: inferDraftTitle(request.requestText),
    startsAt,
    endsAt,
    timezone,
    durationMinutes,
    assignedMemberId:
      candidate?.candidateType === 'member' ? candidate.candidateId : undefined,
    assignedMemberLabel:
      candidate?.candidateType === 'member' ? candidate.label : undefined,
    priority: /\bemergency|urgent|asap\b/i.test(request.requestText ?? '')
      ? 'high'
      : undefined,
    tags: compoundPlan.operations,
    notes: request.requestText,
  }
}

function inferDraftTitle(requestText?: string) {
  const text = requestText?.trim()
  if (!text) return 'Draft scheduling event'
  if (/\bemergency\b/i.test(text)) return 'Emergency Service'
  const cleaned = text
    .replace(/\b(schedule|create|book|set up)\b/gi, '')
    .replace(/\band assign\b.*$/i, '')
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    .trim()
  return cleaned
    ? cleaned
        .split(/\s+/)
        .slice(0, 8)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Draft scheduling event'
}

function toWorkspaceAIContextReferences(
  request: SchedulingAIRequest,
): WorkspaceAIContextReference[] {
  const references = [
    request.currentWorkspace,
    request.currentCalendar,
    request.currentEvent,
    request.currentTechnician,
    request.currentTeam,
    request.currentLocation,
    ...(request.currentSelection ?? []),
  ].filter(Boolean) as SchedulingAIObjectReference[]
  return references.map((reference) => ({
    id: `scheduling:${reference.kind}:${reference.id}`,
    entryPointId: 'scheduling',
    kind: workspaceAIReferenceKind(reference.kind),
    label: reference.label,
    providerId: 'scheduling',
    referenceId: reference.referenceId ?? reference.id,
    metadata: {
      schedulingReferenceKind: reference.kind,
      ...reference.metadata,
    },
  }))
}

function toSchedulingAIRecommendation(
  candidate: SchedulingRecommendationCandidate,
): SchedulingAIRecommendation {
  return {
    id: `scheduling-ai-recommendation:${candidate.candidateType}:${candidate.candidateId}`,
    candidateId: candidate.candidateId,
    candidateType: candidate.candidateType,
    label: candidate.label,
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    warnings: candidate.warnings,
    provenance: {
      ...SCHEDULING_RECOMMENDATION_PROVENANCE,
      aiProviderGeneratedExplanation: false,
    },
    metadata: candidate.metadata,
  }
}

function recommendationExplanation({
  recommendation,
  references,
}: {
  recommendation: SchedulingAIRecommendation
  references: WorkspaceAIReference[]
}): SchedulingAIExplanation {
  return {
    id: `scheduling-ai-explanation:recommendation:${recommendation.candidateType}:${recommendation.candidateId}`,
    title: `Why ${recommendation.label}`,
    summary: recommendation.warnings.length
      ? `${recommendation.label} is recommended with scheduling warnings.`
      : `${recommendation.label} is recommended by deterministic scheduling data.`,
    details: [
      `Score: ${recommendation.score}`,
      `Confidence: ${recommendation.confidence}`,
    ],
    reasons: recommendation.reasons,
    warnings: recommendation.warnings,
    references,
  }
}

function availabilityExplanation({
  title,
  availability,
  references,
}: {
  title: string
  availability: SchedulingAvailabilitySummary | null
  references: WorkspaceAIReference[]
}): SchedulingAIExplanation {
  return {
    id: `scheduling-ai-explanation:availability:${availability?.assigneeId ?? 'unknown'}`,
    title,
    summary: availability
      ? `${availability.label} is ${availability.isAvailable ? 'available' : 'not available'} for the selected range.`
      : 'No matching technician was found in the visible scheduling context.',
    details:
      availability?.conflicts.map((conflict) => conflict.sourceLabel) ?? [],
    reasons: availability?.isAvailable
      ? [
          {
            code: 'available',
            label: 'No blocking deterministic conflicts were found.',
            source: 'availability',
          },
        ]
      : [],
    warnings: availability?.warnings ?? [],
    references,
  }
}

function conflictExplanation({
  conflicts,
  references,
}: {
  conflicts: SchedulingConflict[]
  references: WorkspaceAIReference[]
}): SchedulingAIExplanation {
  const normalizedConflicts = normalizeSchedulingConflictFindings(conflicts)
  const blockingConflicts = normalizedConflicts.filter(
    (conflict) => conflict.blocking,
  )
  return {
    id: 'scheduling-ai-explanation:conflicts',
    title: 'Scheduling conflict',
    summary: blockingConflicts.length
      ? `${blockingConflicts.length} active blocking conflict${blockingConflicts.length === 1 ? '' : 's'} found.`
      : 'No deterministic conflicts were found for the selected range.',
    details: normalizedConflicts.map((conflict) =>
      conflict.blocking
        ? conflict.sourceLabel
        : `${conflict.sourceLabel} (informational availability constraint)`,
    ),
    reasons: blockingConflicts.length
      ? []
      : [
          {
            code: 'no-conflicts',
            label:
              'No blocking scheduling records overlapped the selected range.',
            source: 'events',
          },
        ],
    warnings: normalizedConflicts.map((conflict) => ({
      code:
        conflict.conflictType === 'busy'
          ? 'busy-conflict'
          : conflict.conflictType,
      label: conflict.sourceLabel,
      source:
        conflict.conflictType === 'externalAvailability'
          ? 'externalAvailability'
          : conflict.conflictType === 'outsideWorkingHours'
            ? 'workingHours'
            : conflict.conflictType === 'busy'
              ? 'events'
              : 'availability',
      severity: conflict.severity,
    })) as WorkspaceRecommendationWarning[],
    references,
  }
}

function workloadExplanation({
  workload,
  references,
}: {
  workload: SchedulingWorkloadSummary[]
  references: WorkspaceAIReference[]
}): SchedulingAIExplanation {
  const overloaded = workload.filter((item) => item.overloaded)
  return {
    id: 'scheduling-ai-explanation:workload',
    title: 'Scheduling workload',
    summary: overloaded.length
      ? `${overloaded.length} assignee${overloaded.length === 1 ? ' is' : 's are'} currently overloaded.`
      : 'No overloaded assignees were found in the selected range.',
    details: workload.map(
      (item) =>
        `${item.label}: ${item.eventCount} events, ${item.busyMinutes} busy minutes`,
    ),
    reasons: overloaded.length
      ? []
      : [
          {
            code: 'low-workload',
            label: 'Visible assignees are below workload thresholds.',
            source: 'events',
          },
        ],
    warnings: overloaded.map((item) => ({
      code: 'overloaded',
      label: `${item.label} is overloaded in this planning window.`,
      source: 'events',
      severity: 'warning',
    })),
    references,
  }
}

function getSchedulingAIResponseRendering({
  route,
  references,
  hasActions,
  hasConflicts,
}: {
  route: SchedulingAIIntentRoute
  references: WorkspaceAIReference[]
  hasActions: boolean
  hasConflicts: boolean
}): SchedulingAIRenderingMetadata {
  const primaryCard = hasActions
    ? 'actionProposalCard'
    : route.responseKind === 'recommendation'
      ? 'recommendationCard'
      : route.responseKind === 'summary'
        ? 'summaryCard'
        : route.responseKind === 'analysis' && hasConflicts
          ? 'conflictCard'
          : 'explanationCard'
  return {
    primaryCard,
    cards: [
      primaryCard,
      ...(hasConflicts && primaryCard !== 'conflictCard'
        ? ['conflictCard' as const]
        : []),
      ...(references.length > 0 ? ['explanationCard' as const] : []),
    ],
    layout: hasActions
      ? 'review'
      : route.responseKind === 'recommendation'
        ? 'stacked'
        : 'single',
    referenceIds: references.map((reference) => reference.id),
  }
}

function route(
  workspaceIntent: WorkspaceIntelligenceIntent,
  responseKind: SchedulingAIResponseKind,
  outputType: AIRuntimeOutputType,
  supportedActionTypes: SchedulingAIActionProposalType[] = [],
): SchedulingAIIntentRoute {
  return {
    intent: '' as SchedulingAIIntent,
    workspaceIntent,
    responseKind,
    outputType,
    supportedActionTypes,
  }
}

function emptyDeterministicOutput() {
  return {
    recommendations: [] as SchedulingAIRecommendation[],
    explanations: [] as SchedulingAIExplanation[],
    analysis: undefined,
    summary: undefined,
  }
}

function canUseSchedulingAI(actor: WorkspaceIntelligenceActor) {
  return (
    actor.permissions.includes('workspace:read') &&
    actor.permissions.includes('scheduling:read')
  )
}

function workspaceAIReferenceKind(
  kind: SchedulingAIObjectReference['kind'],
): WorkspaceAIContextReference['kind'] {
  if (kind === 'event') return 'event'
  if (kind === 'technician') return 'member'
  if (kind === 'calendar') return 'calendar'
  if (kind === 'workspace') return 'workspace'
  return 'record'
}

function actionLabel({
  actionType,
  candidate,
  targetLabel,
  draftEvent,
}: {
  actionType: SchedulingAIActionProposalType
  candidate?: SchedulingAIRecommendation
  targetLabel?: string
  draftEvent?: SchedulingDraftEventProposal
}) {
  if (actionType === 'createEventAndAssign') {
    return candidate
      ? `Draft ${draftEvent?.title ?? 'event'} and assign ${candidate.label}`
      : `Draft ${draftEvent?.title ?? 'event'} and choose technician`
  }
  if (actionType === 'createEvent') {
    return `Draft ${draftEvent?.title ?? 'scheduling event'}`
  }
  if (actionType === 'assignTechnician') {
    return candidate && targetLabel
      ? `Assign ${candidate.label} to ${targetLabel}`
      : candidate
        ? `Assign ${candidate.label}`
        : 'Assign technician'
  }
  if (actionType === 'changeTeam') {
    return candidate && targetLabel
      ? `Change ${targetLabel} team to ${candidate.label}`
      : candidate
        ? `Change team to ${candidate.label}`
        : 'Change team'
  }
  if (actionType === 'moveAppointment') {
    return candidate && targetLabel
      ? `Move ${targetLabel} to ${candidate.label}`
      : candidate
        ? `Move appointment to ${candidate.label}`
        : 'Move appointment'
  }
  if (actionType === 'notifyCustomer') return 'Notify customer'
  if (actionType === 'createTask') return 'Create task'
  return 'Update recurring schedule'
}

function proposalMissingFields({
  actionType,
  eventId,
  eventLabel,
  candidate,
  draftEvent,
}: {
  actionType: SchedulingAIActionProposalType
  eventId?: string
  eventLabel?: string
  candidate?: SchedulingAIRecommendation
  draftEvent?: SchedulingDraftEventProposal
}) {
  const missing: string[] = []
  if (actionType === 'createEvent' || actionType === 'createEventAndAssign') {
    if (!draftEvent?.title) missing.push('event title')
    if (!draftEvent?.startsAt) missing.push('scheduled start time')
    if (!draftEvent?.endsAt) missing.push('scheduled end time')
    if (!draftEvent?.timezone) missing.push('timezone')
    if (actionType === 'createEventAndAssign' && !candidate?.candidateId) {
      missing.push('proposed technician')
    }
    return missing
  }
  if (
    actionType === 'assignTechnician' ||
    actionType === 'moveAppointment' ||
    actionType === 'changeTeam'
  ) {
    if (!eventId) missing.push('target scheduling record ID')
    if (!eventLabel) missing.push('target scheduling record label')
    if (!candidate?.candidateId) missing.push('proposed value')
    if (!candidate?.reasons.length) missing.push('supporting reason')
  }
  if (actionType === 'notifyCustomer') {
    if (!eventId) missing.push('related scheduling record')
    missing.push('validated customer/contact reference')
    missing.push('delivery channel readiness')
  }
  if (actionType === 'createTask') {
    if (!eventId) missing.push('related scheduling record')
    missing.push('task title')
    missing.push('owner or assignment intent')
  }
  if (actionType === 'updateRecurringSchedule') {
    missing.push('recurring series ID')
    missing.push('current recurrence')
    missing.push('proposed recurrence')
  }
  return missing
}

function proposalSummary({
  actionType,
  candidate,
  eventLabel,
}: {
  actionType: SchedulingAIActionProposalType
  candidate?: SchedulingAIRecommendation
  eventLabel?: string
}) {
  if (actionType === 'createEventAndAssign') {
    return `Prepare an approval-required event draft with ${candidate?.label ?? 'the selected technician'} assigned.`
  }
  if (actionType === 'createEvent') {
    return 'Prepare an approval-required event draft for review before it is saved.'
  }
  if (actionType === 'assignTechnician') {
    return `Prepare an approval-required assignment change for ${eventLabel} using ${candidate?.label}.`
  }
  if (actionType === 'changeTeam') {
    return `Prepare an approval-required team change for ${eventLabel} using ${candidate?.label}.`
  }
  if (actionType === 'moveAppointment') {
    return `Prepare an approval-required schedule move for ${eventLabel}.`
  }
  return 'Prepare an approval-required scheduling proposal.'
}

function proposalCurrentState({
  actionType,
  request,
}: {
  actionType: SchedulingAIActionProposalType
  request: SchedulingAIRequest
}) {
  if (actionType === 'assignTechnician') {
    return request.currentTechnician?.label
      ? `Currently assigned to ${request.currentTechnician.label}`
      : 'Current assignment not provided'
  }
  if (actionType === 'changeTeam') {
    return request.currentTeam?.label
      ? `Current team: ${request.currentTeam.label}`
      : 'Current team not provided'
  }
  if (actionType === 'moveAppointment')
    return 'Current appointment time from selected record'
  return 'Current state requires review'
}

function proposalProposedState({
  actionType,
  candidate,
  draftEvent,
}: {
  actionType: SchedulingAIActionProposalType
  candidate?: SchedulingAIRecommendation
  draftEvent?: SchedulingDraftEventProposal
}) {
  if (draftEvent) {
    return [
      draftEvent.title,
      draftEvent.startsAt
        ? `Start: ${formatSchedulingAIProposalDateTime(draftEvent.startsAt, draftEvent.timezone)}`
        : undefined,
      draftEvent.endsAt
        ? `End: ${formatSchedulingAIProposalDateTime(draftEvent.endsAt, draftEvent.timezone)}`
        : undefined,
      draftEvent.assignedMemberLabel
        ? `Technician: ${draftEvent.assignedMemberLabel}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  if (!candidate) return undefined
  if (actionType === 'assignTechnician') return `Assign to ${candidate.label}`
  if (actionType === 'changeTeam') return `Change team to ${candidate.label}`
  if (actionType === 'moveAppointment') return `Move to ${candidate.label}`
  return candidate.label
}

function formatSchedulingAIProposalDateTime(value: string, timezone: string) {
  return formatInWorkspaceTimezone(value, timezone, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function proposalExplanation({
  actionType,
  candidate,
}: {
  actionType: SchedulingAIActionProposalType
  candidate?: SchedulingAIRecommendation
}) {
  const reason = candidate?.reasons[0]?.label
  if (reason) return reason
  if (actionType === 'createEvent' || actionType === 'createEventAndAssign') {
    return 'The event remains an editable draft and requires approval before Skillify writes it to the calendar.'
  }
  if (actionType === 'assignTechnician') {
    return 'The recommended assignee was selected from deterministic scheduling availability.'
  }
  return 'The proposal is based on deterministic scheduling recommendations.'
}

function proposalExpectedImpact({
  actionType,
}: {
  actionType: SchedulingAIActionProposalType
}) {
  if (actionType === 'assignTechnician') {
    return [
      'Creates a reviewable assignment change.',
      'Does not execute or mutate scheduling records in the Playground.',
    ]
  }
  if (actionType === 'createEvent' || actionType === 'createEventAndAssign') {
    return [
      'Creates an editable event proposal for owner review.',
      'Does not create a calendar event until approval.',
    ]
  }
  if (actionType === 'moveAppointment') {
    return [
      'Creates a reviewable schedule-change preview.',
      'Does not move the appointment in the Playground.',
    ]
  }
  return [
    'Creates a reviewable proposal preview.',
    'Execution remains unavailable in the Playground.',
  ]
}

function actionParameters({
  request,
  candidate,
  draftEvent,
  compoundPlan,
}: {
  request: SchedulingAIRequest
  candidate?: SchedulingAIRecommendation
  draftEvent?: SchedulingDraftEventProposal
  compoundPlan?: SchedulingCompoundPlan
}): Record<string, unknown> {
  return {
    eventId: request.currentEvent?.referenceId ?? request.currentEvent?.id,
    candidateId: candidate?.candidateId,
    candidateType: candidate?.candidateType,
    schedulingAIIntent: request.intent,
    compoundOperations: compoundPlan?.operations ?? [],
    draftEvent,
    approvalRequired: true,
  }
}

function analysisTitle(intent: SchedulingAIIntent) {
  if (intent === 'analyzeConflicts') return 'Conflict analysis'
  if (intent === 'analyzeWorkload') return 'Workload analysis'
  return 'Schedule analysis'
}

function highestConfidence(values: AIRuntimeConfidence[]): AIRuntimeConfidence {
  if (values.includes('high')) return 'high'
  if (values.includes('medium')) return 'medium'
  if (values.includes('low')) return 'low'
  return 'unknown'
}

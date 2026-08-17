import {
  WorkspaceAIRuntime,
  workspaceAIRuntimeRegistry,
  type AIRuntimeConfidence,
  type AIRuntimeGovernedKnowledge,
  type AIRuntimeRequest,
  type AIRuntimeResponse,
  type AIRuntimeExecutionMode,
  type AIRuntimeOutputType,
  type ActionProposal,
  type ConversationMetadata,
  type StructuredAIRequest,
  type StructuredAIOutput,
  type StructuredPrompt,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import type {
  WorkspaceIntelligenceActor,
  WorkspaceIntelligenceCapabilityKey,
  WorkspaceIntelligenceIntent,
  WorkspaceIntelligenceWorkspace,
  WorkspaceKnowledgeProviderId,
  WorkspaceKnowledgeReference,
  WorkspaceRecommendation,
  NormalizedWorkspaceRecommendation,
  WorkspaceRecommendationNormalizationDiagnostic,
  WorkspaceExplanation,
} from '@/lib/intelligence/workspaceIntelligence'
import { normalizeWorkspaceRecommendations } from '@/lib/intelligence/workspaceIntelligence'
import {
  buildOperationalIntelligenceSnapshot,
  type OperationalIntelligenceSnapshot,
} from '@/lib/ai/operational/operationalIntelligence'

export type WorkspaceAIEntryPointId =
  | 'workspace'
  | 'crm'
  | 'scheduling'
  | 'workflowBuilder'
  | 'automation'
  | 'projects'
  | 'dashboard'
  | 'reports'

export type WorkspaceAIContextReference = {
  id: string
  entryPointId: WorkspaceAIEntryPointId
  kind:
    | 'workspace'
    | 'record'
    | 'workflow'
    | 'workflow-node'
    | 'validation-state'
    | 'calendar'
    | 'event'
    | 'member'
    | 'metric'
    | 'widget'
    | 'pipeline'
  label: string
  providerId?: WorkspaceKnowledgeProviderId
  referenceId?: string
  metadata?: Record<string, unknown>
}

export type WorkspaceAISessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'completedWithFallback'
  | 'failed'

export type WorkspaceAISession = {
  id: string
  workspace: WorkspaceIntelligenceWorkspace
  actor: WorkspaceIntelligenceActor
  entryPointId: WorkspaceAIEntryPointId
  permissions: string[]
  currentIntent: WorkspaceIntelligenceIntent
  currentContext: WorkspaceAIContextReference[]
  currentProviderUsage: WorkspaceAIProviderUsage
  currentRuntimeState: WorkspaceAIRuntimeState
  conversation?: WorkspaceAIConversationMetadata
  createdAt: string
  updatedAt: string
}

export type WorkspaceAIRuntimeState = {
  status: WorkspaceAISessionStatus
  lastRuntimeRequestId?: string
  lastRuntimeEventTypes: string[]
  warnings: WorkspaceAIWarning[]
}

export type WorkspaceAIProviderUsage = {
  knowledgeProviderIds: WorkspaceKnowledgeProviderId[]
  llmProviderId?: string
  toolIds: string[]
}

export type WorkspaceAIUserRequest = {
  id: string
  session: WorkspaceAISession
  requestedIntent?: WorkspaceIntelligenceIntent
  requestedOutputType?: AIRuntimeOutputType
  contextReferences?: WorkspaceAIContextReference[]
  requestedCapabilities?: WorkspaceIntelligenceCapabilityKey[]
  allowedToolIds?: string[]
  allowedActionTypes?: string[]
  executionMode?: AIRuntimeExecutionMode
  llmProviderId?: string
  providerSources?: Partial<Record<WorkspaceKnowledgeProviderId, unknown>>
  governedKnowledge?: AIRuntimeGovernedKnowledge
  requestText?: string
  attachments?: WorkspaceAIAttachment[]
  conversation?: WorkspaceAIConversationRequest
  now?: Date
}

export type WorkspaceAIResponse = {
  id: string
  session: WorkspaceAISession
  intent: WorkspaceIntelligenceIntent
  responseType: AIRuntimeOutputType
  confidence: AIRuntimeResponse['confidence']
  answer?: {
    summary: string
    details?: string[]
  }
  recommendations: NormalizedWorkspaceRecommendation[]
  explanations: WorkspaceExplanation[]
  warnings: WorkspaceAIWarning[]
  suggestedActions: WorkspaceAISuggestedAction[]
  approvals: WorkspaceAIApproval[]
  references: WorkspaceAIReference[]
  followUpSuggestions: string[]
  providerUsage: WorkspaceAIProviderUsage
  rendering: WorkspaceAIResponseRendering
  runtimeResponse: AIRuntimeResponse
  operationalIntelligence: OperationalIntelligenceSnapshot
  normalization?: WorkspaceAIResponseNormalization
  recommendationNormalization?: {
    diagnostics: WorkspaceRecommendationNormalizationDiagnostic[]
  }
}

export type WorkspaceAIResponseNormalization = {
  repaired: boolean
  repairCount: number
  repairs: string[]
  developerNotice?: string
}

export type WorkspaceAIExperienceBuilderName =
  | 'normalizeRuntimeResponse'
  | 'buildReferences'
  | 'buildSummary'
  | 'buildRuntimeWarnings'
  | 'buildProposal'
  | 'buildSession'
  | 'buildRecommendations'
  | 'buildOperationalIntelligence'
  | 'buildRendering'
  | 'assembleResponse'

export type WorkspaceAIExperienceBuilderDiagnostic = {
  requestId: string
  runtimeRequestId?: string
  builder: WorkspaceAIExperienceBuilderName
  functionName: string
  file: string
  line?: number
  exceptionClass: string
  exceptionMessage: string
  stack?: string
  failingObjectType: string
  objectKeys: string[]
  sampleKeys?: string[]
  missingKeys: string[]
  missingProperty?: string
  timestamp: string
}

export class WorkspaceAIExperienceAssemblyError extends Error {
  readonly diagnostic: WorkspaceAIExperienceBuilderDiagnostic
  readonly cause: unknown

  constructor({
    diagnostic,
    cause,
  }: {
    diagnostic: WorkspaceAIExperienceBuilderDiagnostic
    cause: unknown
  }) {
    super(
      `Workspace AI Experience builder ${diagnostic.functionName} failed: ${diagnostic.exceptionMessage}`,
    )
    this.name = 'WorkspaceAIExperienceAssemblyError'
    this.diagnostic = diagnostic
    this.cause = cause
  }
}

export function isWorkspaceAIExperienceAssemblyError(
  error: unknown,
): error is WorkspaceAIExperienceAssemblyError {
  return (
    error instanceof WorkspaceAIExperienceAssemblyError ||
    Boolean(
      error &&
      typeof error === 'object' &&
      (error as { name?: unknown }).name ===
        'WorkspaceAIExperienceAssemblyError' &&
      (error as { diagnostic?: unknown }).diagnostic,
    )
  )
}

export type WorkspaceAIWarning = {
  code: string
  message: string
  severity: 'info' | 'warning' | 'blocking'
}

export type WorkspaceAIEntryPointDefinition = {
  id: WorkspaceAIEntryPointId
  label: string
  supportedIntents: WorkspaceIntelligenceIntent[]
  allowedCapabilities: WorkspaceIntelligenceCapabilityKey[]
  allowedToolIds: string[]
  defaultProviderPriorities: WorkspaceKnowledgeProviderId[]
  permissionRequirements: string[]
  defaultOutputType: AIRuntimeOutputType
}

export type WorkspaceAIEntryPointRegistry = {
  list: () => WorkspaceAIEntryPointDefinition[]
  get: (
    entryPointId: WorkspaceAIEntryPointId,
  ) => WorkspaceAIEntryPointDefinition | null
  supportsIntent: (
    entryPointId: WorkspaceAIEntryPointId,
    intent: WorkspaceIntelligenceIntent,
  ) => boolean
}

export type WorkspaceAIMessageRole = 'user' | 'assistant' | 'system'

export type WorkspaceAIMessage = {
  id: string
  role: WorkspaceAIMessageRole
  createdAt: string
  contentReference?: WorkspaceAIReference
  attachments?: WorkspaceAIAttachment[]
}

export type WorkspaceAITurn = {
  id: string
  requestMessage?: WorkspaceAIMessage
  responseMessage?: WorkspaceAIMessage
  intent?: WorkspaceIntelligenceIntent
  references: WorkspaceAIReference[]
  createdAt: string
}

export type WorkspaceAIConversation = {
  id: string
  workspaceId: string
  metadata?: WorkspaceAIConversationMetadata
  turns: WorkspaceAITurn[]
}

export type WorkspaceAIConversationMetadata = ConversationMetadata & {
  source?: WorkspaceAIEntryPointId
}

export type WorkspaceAIConversationRequest = {
  metadata?: WorkspaceAIConversationMetadata
  turns?: WorkspaceAITurn[]
}

export type WorkspaceAIReference = {
  id: string
  label: string
  providerId?: WorkspaceKnowledgeProviderId
  source:
    | 'runtime'
    | 'workspace-intelligence'
    | 'entry-point-context'
    | 'attachment'
    | 'conversation'
  knowledgeReference?: WorkspaceKnowledgeReference
  contextReference?: WorkspaceAIContextReference
}

export type WorkspaceAIAttachment = {
  id: string
  label: string
  contentType: string
  reference: WorkspaceAIReference
  metadata?: Record<string, unknown>
}

export type WorkspaceAIApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'deferred'

export type WorkspaceAIApproval = {
  id: string
  status: WorkspaceAIApprovalStatus
  actionProposalId: string
  requiredPermission?: string
  expiresAt?: string
  decidedAt?: string
  decidedByUserId?: string
}

export type WorkspaceAISuggestedAction = ActionProposal & {
  approval: WorkspaceAIApproval
  executionBoundary: 'proposal-only'
}

export type WorkspaceAIResponseRendering = {
  responseType: AIRuntimeOutputType
  severity: 'neutral' | 'success' | 'warning' | 'critical'
  recommendedLayout:
    | 'compact'
    | 'summary'
    | 'recommendation-list'
    | 'action-review'
  expandableSections: Array<'details' | 'references' | 'warnings' | 'actions'>
  referenceIds: string[]
}

export const defaultWorkspaceAIEntryPoints: WorkspaceAIEntryPointDefinition[] =
  [
    {
      id: 'workspace',
      label: 'Workspace AI',
      supportedIntents: [
        'knowledge.resolve',
        'search.lookup',
        'recommendation.general',
        'explanation.general',
        'summarization.general',
        'analysis.general',
        'workspace.investigateQuestion',
      ],
      allowedCapabilities: [
        'supportsContext',
        'supportsSnapshot',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: ['workspace-intelligence.context.assemble'],
      defaultProviderPriorities: ['scheduling'],
      permissionRequirements: ['workspace:read'],
      defaultOutputType: 'answer',
    },
    {
      id: 'scheduling',
      label: 'Scheduling AI',
      supportedIntents: [
        'scheduling.findBestMember',
        'scheduling.findBestTeam',
        'scheduling.findAvailableSlot',
        'scheduling.findRecurringSlot',
        'scheduling.explainConflict',
        'scheduling.explainAssignment',
        'scheduling.explainUnavailable',
        'scheduling.rescheduleAppointment',
        'scheduling.assignEvent',
        'scheduling.balanceWorkload',
      ],
      allowedCapabilities: [
        'supportsContext',
        'supportsSnapshot',
        'supportsRecommendations',
        'supportsExplanation',
        'supportsSchedulingRecommendations',
        'supportsSchedulingAvailability',
        'supportsSchedulingConflicts',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: [
        'workspace-intelligence.context.assemble',
        'workspace-intelligence.recommendations.resolve',
        'workspace-intelligence.explanations.resolve',
      ],
      defaultProviderPriorities: ['scheduling'],
      permissionRequirements: ['workspace:read', 'scheduling:read'],
      defaultOutputType: 'recommendations',
    },
    {
      id: 'workflowBuilder',
      label: 'Workflow Builder AI',
      supportedIntents: [
        'workflow.generate',
        'workflow.explain',
        'workflow.analyzeRun',
        'analysis.general',
      ],
      allowedCapabilities: [
        'supportsContext',
        'supportsWorkflowGeneration',
        'supportsWorkflowExplanation',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: ['workspace-intelligence.context.assemble'],
      defaultProviderPriorities: [],
      permissionRequirements: ['workspace:read'],
      defaultOutputType: 'explanation',
    },
    {
      id: 'crm',
      label: 'CRM AI',
      supportedIntents: [
        'crm.explainRecord',
        'crm.analyzePipeline',
        'crm.prioritizeLeads',
        'crm.analyzeFollowUps',
        'crm.analyzeOpportunities',
        'crm.recommendNextActions',
        'crm.analyzeDataQuality',
        'analysis.general',
      ],
      allowedCapabilities: [
        'supportsContext',
        'supportsSnapshot',
        'supportsRecommendations',
        'supportsExplanation',
        'supportsCRMAnalysis',
        'supportsCRMRecommendations',
        'supportsCRMDataQuality',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: [
        'workspace-intelligence.crm-context.assemble',
        'workspace-intelligence.crm-recommendations.resolve',
        'workspace-intelligence.explanations.resolve',
      ],
      defaultProviderPriorities: ['crm'],
      permissionRequirements: ['workspace:read', 'crm:read'],
      defaultOutputType: 'explanation',
    },
    {
      id: 'automation',
      label: 'Automation AI',
      supportedIntents: [
        'workflow.explain',
        'workflow.analyzeRun',
        'analysis.general',
      ],
      allowedCapabilities: [
        'supportsContext',
        'supportsAutomation',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: ['workspace-intelligence.context.assemble'],
      defaultProviderPriorities: [],
      permissionRequirements: ['workspace:read'],
      defaultOutputType: 'analysis',
    },
    {
      id: 'projects',
      label: 'Project AI',
      supportedIntents: ['projects.summarize', 'tasks.recommendPriorities'],
      allowedCapabilities: [
        'supportsContext',
        'supportsProjectAnalysis',
        'supportsTaskAnalysis',
      ],
      allowedToolIds: ['workspace-intelligence.context.assemble'],
      defaultProviderPriorities: [],
      permissionRequirements: ['workspace:read'],
      defaultOutputType: 'summary',
    },
    {
      id: 'dashboard',
      label: 'Dashboard AI',
      supportedIntents: [
        'reports.explainMetric',
        'analysis.general',
        'summarization.general',
      ],
      allowedCapabilities: [
        'supportsContext',
        'supportsReporting',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: ['workspace-intelligence.context.assemble'],
      defaultProviderPriorities: [],
      permissionRequirements: ['workspace:read'],
      defaultOutputType: 'summary',
    },
    {
      id: 'reports',
      label: 'Reports AI',
      supportedIntents: ['reports.explainMetric', 'analysis.general'],
      allowedCapabilities: [
        'supportsContext',
        'supportsReporting',
        'supportsKnowledgeReferences',
      ],
      allowedToolIds: ['workspace-intelligence.context.assemble'],
      defaultProviderPriorities: [],
      permissionRequirements: ['workspace:read'],
      defaultOutputType: 'analysis',
    },
  ]

export function createWorkspaceAIEntryPointRegistry(
  entries: WorkspaceAIEntryPointDefinition[] = defaultWorkspaceAIEntryPoints,
): WorkspaceAIEntryPointRegistry {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]))
  return {
    list: () => [...entryMap.values()],
    get: (entryPointId) => entryMap.get(entryPointId) ?? null,
    supportsIntent: (entryPointId, intent) =>
      entryMap.get(entryPointId)?.supportedIntents.includes(intent) ?? false,
  }
}

export const workspaceAIEntryPointRegistry =
  createWorkspaceAIEntryPointRegistry()

export function createWorkspaceAISession({
  id,
  workspace,
  actor,
  entryPointId,
  intent,
  contextReferences = [],
  conversation,
  now = new Date(),
  entryPointRegistry = workspaceAIEntryPointRegistry,
}: {
  id: string
  workspace: WorkspaceIntelligenceWorkspace
  actor: WorkspaceIntelligenceActor
  entryPointId: WorkspaceAIEntryPointId
  intent?: WorkspaceIntelligenceIntent
  contextReferences?: WorkspaceAIContextReference[]
  conversation?: WorkspaceAIConversationMetadata
  now?: Date
  entryPointRegistry?: WorkspaceAIEntryPointRegistry
}): WorkspaceAISession {
  const entryPoint = requiredEntryPoint(entryPointRegistry, entryPointId)
  const currentIntent =
    intent ?? entryPoint.supportedIntents[0] ?? 'analysis.general'
  const timestamp = now.toISOString()
  return {
    id,
    workspace,
    actor,
    entryPointId,
    permissions: [...actor.permissions].sort(),
    currentIntent,
    currentContext: normalizeContextReferences(contextReferences),
    currentProviderUsage: {
      knowledgeProviderIds: [],
      llmProviderId: undefined,
      toolIds: [],
    },
    currentRuntimeState: {
      status: 'idle',
      lastRuntimeEventTypes: [],
      warnings: [],
    },
    conversation,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export async function runWorkspaceAIRequest({
  request,
  runtime = new WorkspaceAIRuntime(),
  entryPointRegistry = workspaceAIEntryPointRegistry,
}: {
  request: WorkspaceAIUserRequest
  runtime?: WorkspaceAIRuntime
  entryPointRegistry?: WorkspaceAIEntryPointRegistry
}): Promise<WorkspaceAIResponse> {
  const entryPoint = requiredEntryPoint(
    entryPointRegistry,
    request.session.entryPointId,
  )
  const requestedIntent =
    request.requestedIntent ?? request.session.currentIntent
  const warnings: WorkspaceAIWarning[] = []
  if (!entryPoint.supportedIntents.includes(requestedIntent)) {
    warnings.push({
      code: 'entry-point-intent-unsupported',
      message: `Entry point ${entryPoint.id} does not explicitly support intent ${requestedIntent}.`,
      severity: 'warning',
    })
  }
  const runtimeRequest = toRuntimeRequest({
    request,
    entryPoint,
    requestedIntent,
  })
  const runtimeResponse = await runtime.run(runtimeRequest)
  const response = toWorkspaceAIResponse({
    request,
    entryPoint,
    runtimeResponse,
    requestedIntent,
    warnings,
  })
  return response
}

export function toRuntimeRequest({
  request,
  entryPoint,
  requestedIntent,
}: {
  request: WorkspaceAIUserRequest
  entryPoint: WorkspaceAIEntryPointDefinition
  requestedIntent: WorkspaceIntelligenceIntent
}): AIRuntimeRequest {
  return {
    id: `workspace-ai-runtime:${request.id}`,
    actor: request.session.actor,
    workspace: request.session.workspace,
    requestedIntent,
    conversation: request.conversation
      ? {
          metadata: request.conversation.metadata,
          turns: request.conversation.turns?.map((turn) => ({
            id: turn.id,
            role: 'user' as const,
            createdAt: turn.createdAt,
            contentReferenceId: turn.requestMessage?.contentReference?.id,
          })),
        }
      : request.session.conversation
        ? { metadata: request.session.conversation }
        : undefined,
    requestedCapabilities:
      request.requestedCapabilities?.filter((capability) =>
        entryPoint.allowedCapabilities.includes(capability),
      ) ?? entryPoint.allowedCapabilities,
    allowedToolIds:
      request.allowedToolIds?.filter((toolId) =>
        entryPoint.allowedToolIds.includes(toolId),
      ) ?? entryPoint.allowedToolIds,
    requestedProviderIds: resolveWorkspaceAIProviderPriorities({
      request,
      entryPoint,
      requestedIntent,
    }),
    requestedOutputType:
      request.requestedOutputType ?? entryPoint.defaultOutputType,
    executionMode: request.executionMode ?? 'prepareOnly',
    llmProviderId: request.llmProviderId,
    providerSources: request.providerSources,
    governedKnowledge: request.governedKnowledge,
    allowedActionTypes: request.allowedActionTypes ?? [],
    now: request.now,
    constraints: [
      `Workspace AI entry point: ${entryPoint.id}`,
      'Return structured response data for future UI rendering.',
      'Do not execute suggested actions.',
      ...(request.requestText?.trim()
        ? [`User request: ${request.requestText.trim().slice(0, 2_000)}`]
        : []),
    ],
  }
}

function resolveWorkspaceAIProviderPriorities({
  request,
  entryPoint,
  requestedIntent,
}: {
  request: WorkspaceAIUserRequest
  entryPoint: WorkspaceAIEntryPointDefinition
  requestedIntent: WorkspaceIntelligenceIntent
}): WorkspaceKnowledgeProviderId[] | undefined {
  if (requestedIntent.startsWith('crm.')) return ['crm']
  if (requestedIntent.startsWith('scheduling.')) return ['scheduling']
  if (entryPoint.id !== 'workspace') return entryPoint.defaultProviderPriorities

  const text = (request.requestText ?? '').toLowerCase()
  const mentionsCRM =
    /\b(crm|lead|leads|opportunit|pipeline|client|clients|follow[- ]?up|sales)\b/.test(
      text,
    )
  const mentionsScheduling =
    /\b(schedule|scheduling|calendar|appointment|technician|availability|time off|busy|meeting|service visit)\b/.test(
      text,
    )
  const mentionsUnsupportedOperationalDomain =
    /\b(automation|automations|workflow|workflows|task|tasks|service request|service requests|execution|executions)\b/.test(
      text,
    )

  if (mentionsCRM && !mentionsScheduling) return ['crm']
  if (mentionsScheduling && !mentionsCRM) return ['scheduling']
  if (
    mentionsUnsupportedOperationalDomain &&
    !mentionsCRM &&
    !mentionsScheduling
  )
    return []
  if (mentionsCRM && mentionsScheduling) return ['crm', 'scheduling']
  return entryPoint.defaultProviderPriorities.length
    ? entryPoint.defaultProviderPriorities
    : undefined
}

export function toWorkspaceAIResponse({
  request,
  entryPoint,
  runtimeResponse,
  requestedIntent,
  warnings,
}: {
  request: WorkspaceAIUserRequest
  entryPoint: WorkspaceAIEntryPointDefinition
  runtimeResponse: AIRuntimeResponse
  requestedIntent: WorkspaceIntelligenceIntent
  warnings: WorkspaceAIWarning[]
}): WorkspaceAIResponse {
  const instrumentation = createWorkspaceAIExperienceInstrumentation({
    requestId: request.id,
    runtimeRequestId: runtimeResponse?.requestId,
  })
  const { runtimeResponse: normalizedRuntimeResponse, normalization } =
    instrumentation.run(
      'normalizeRuntimeResponse',
      {
        value: runtimeResponse,
        expectedKeys: [
          'requestId',
          'intent',
          'structuredResponse',
          'providerUsage',
          'toolUsage',
          'validation',
          'providerOutcome',
        ],
      },
      () =>
        normalizeWorkspaceAIRuntimeResponse({
          runtimeResponse,
          requestedIntent,
          fallbackRequestId: `workspace-ai-runtime:${request.id}`,
        }),
    )
  const references = instrumentation.run(
    'buildReferences',
    {
      value: {
        runtimeKnowledgeReferences:
          normalizedRuntimeResponse.knowledgeReferences,
        contextReferences: [
          ...request.session.currentContext,
          ...(request.contextReferences ?? []),
        ],
      },
      expectedKeys: ['runtimeKnowledgeReferences', 'contextReferences'],
    },
    () =>
      buildWorkspaceAIReferences({
        runtimeResponse: normalizedRuntimeResponse,
        contextReferences: [
          ...request.session.currentContext,
          ...(request.contextReferences ?? []),
        ],
      }),
  )
  const answer = instrumentation.run(
    'buildSummary',
    {
      value: normalizedRuntimeResponse.structuredResponse.answer,
      expectedKeys: ['summary', 'details'],
    },
    () => normalizedRuntimeResponse.structuredResponse.answer,
  )
  const runtimeWarnings = instrumentation.run(
    'buildRuntimeWarnings',
    {
      value: normalizedRuntimeResponse.warnings,
      expectedKeys: ['code', 'message', 'severity'],
    },
    () =>
      normalizedRuntimeResponse.warnings.map(
        (warning): WorkspaceAIWarning => ({
          code: warning.code,
          message: warning.message,
          severity: warning.severity,
        }),
      ),
  )
  const suggestedActions = instrumentation.run(
    'buildProposal',
    {
      value: normalizedRuntimeResponse.recommendedActions,
      expectedKeys: ['id', 'actionType', 'label', 'confidence'],
    },
    () =>
      normalizedRuntimeResponse.recommendedActions.map(
        (proposal): WorkspaceAISuggestedAction => ({
          ...proposal,
          approval: createWorkspaceAIApproval({
            actionProposalId: proposal.id,
            requiredPermission: entryPoint.permissionRequirements[0],
          }),
          executionBoundary: 'proposal-only',
        }),
      ),
  )
  const session = instrumentation.run(
    'buildSession',
    {
      value: {
        session: request.session,
        runtimeResponse: normalizedRuntimeResponse,
        contextReferences: request.contextReferences,
        warnings: [...warnings, ...runtimeWarnings],
      },
      expectedKeys: ['session', 'runtimeResponse', 'warnings'],
    },
    () =>
      updateSessionFromRuntime({
        session: request.session,
        runtimeResponse: normalizedRuntimeResponse,
        requestedIntent,
        contextReferences: request.contextReferences ?? [],
        warnings: [...warnings, ...runtimeWarnings],
      }),
  )
  const responseId = `workspace-ai-response:${request.id}`
  const recommendationNormalization = instrumentation.run(
    'buildRecommendations',
    {
      value: normalizedRuntimeResponse.structuredResponse.recommendations,
      expectedKeys: [
        'id',
        'providerId',
        'intent',
        'subject',
        'score',
        'confidence',
      ],
    },
    () =>
      normalizeWorkspaceRecommendations({
        recommendations:
          normalizedRuntimeResponse.structuredResponse.recommendations,
        requestId: normalizedRuntimeResponse.requestId,
        producer: `${entryPoint.id}:workspace-ai-runtime`,
        fallbackIntent: requestedIntent,
        fallbackProviderId:
          normalizedRuntimeResponse.providerUsage.knowledgeProviderIds[0],
      }),
  )
  const recommendations = recommendationNormalization.recommendations
  const operationalIntelligence = instrumentation.run(
    'buildOperationalIntelligence',
    {
      value: {
        runtimeResponse: normalizedRuntimeResponse,
        recommendations,
        actionProposals: normalizedRuntimeResponse.recommendedActions,
      },
      expectedKeys: ['runtimeResponse', 'recommendations', 'actionProposals'],
    },
    () =>
      buildOperationalIntelligenceSnapshot({
        workspaceId: request.session.workspace.id,
        responseId,
        runtimeResponse: normalizedRuntimeResponse,
        recommendations,
        actionProposals: normalizedRuntimeResponse.recommendedActions,
        now: request.now,
      }),
  )
  const rendering = instrumentation.run(
    'buildRendering',
    {
      value: {
        responseType: normalizedRuntimeResponse.structuredResponse.type,
        warnings: [...warnings, ...runtimeWarnings],
        suggestedActions,
        references,
      },
      expectedKeys: [
        'responseType',
        'warnings',
        'suggestedActions',
        'references',
      ],
    },
    () =>
      getWorkspaceAIResponseRendering({
        responseType: normalizedRuntimeResponse.structuredResponse.type,
        warnings: [...warnings, ...runtimeWarnings],
        suggestedActions,
        references,
      }),
  )
  return instrumentation.run(
    'assembleResponse',
    {
      value: {
        session,
        recommendations,
        suggestedActions,
        references,
        operationalIntelligence,
        rendering,
      },
      expectedKeys: [
        'session',
        'recommendations',
        'suggestedActions',
        'references',
        'operationalIntelligence',
        'rendering',
      ],
    },
    () => ({
      id: responseId,
      session,
      intent: normalizedRuntimeResponse.intent,
      responseType: normalizedRuntimeResponse.structuredResponse.type,
      confidence: normalizedRuntimeResponse.confidence,
      answer,
      recommendations,
      explanations: [],
      warnings: [...warnings, ...runtimeWarnings],
      suggestedActions,
      approvals: suggestedActions.map((action) => action.approval),
      references,
      followUpSuggestions: normalizedRuntimeResponse.followUpSuggestions,
      providerUsage: {
        knowledgeProviderIds:
          normalizedRuntimeResponse.providerUsage.knowledgeProviderIds,
        llmProviderId: normalizedRuntimeResponse.providerUsage.llmProviderId,
        toolIds: normalizedRuntimeResponse.toolUsage.eligibleToolIds,
      },
      rendering,
      runtimeResponse: normalizedRuntimeResponse,
      operationalIntelligence,
      normalization,
      recommendationNormalization: {
        diagnostics: recommendationNormalization.diagnostics,
      },
    }),
  )
}

export function createWorkspaceAIApproval({
  actionProposalId,
  requiredPermission,
  status = 'pending',
}: {
  actionProposalId: string
  requiredPermission?: string
  status?: WorkspaceAIApprovalStatus
}): WorkspaceAIApproval {
  return {
    id: `approval:${actionProposalId}`,
    status,
    actionProposalId,
    requiredPermission,
  }
}

export function getWorkspaceAIResponseRendering({
  responseType,
  warnings,
  suggestedActions,
  references,
}: {
  responseType: AIRuntimeOutputType
  warnings: WorkspaceAIWarning[]
  suggestedActions: WorkspaceAISuggestedAction[]
  references: WorkspaceAIReference[]
}): WorkspaceAIResponseRendering {
  const hasBlocking = warnings.some(
    (warning) => warning.severity === 'blocking',
  )
  const hasWarning = warnings.some((warning) => warning.severity === 'warning')
  return {
    responseType,
    severity: hasBlocking ? 'critical' : hasWarning ? 'warning' : 'neutral',
    recommendedLayout:
      suggestedActions.length > 0
        ? 'action-review'
        : responseType === 'recommendations'
          ? 'recommendation-list'
          : responseType === 'answer'
            ? 'compact'
            : 'summary',
    expandableSections: [
      ...(warnings.length > 0 ? ['warnings' as const] : []),
      ...(references.length > 0 ? ['references' as const] : []),
      ...(suggestedActions.length > 0 ? ['actions' as const] : []),
      'details',
    ],
    referenceIds: references.map((reference) => reference.id),
  }
}

function updateSessionFromRuntime({
  session,
  runtimeResponse,
  requestedIntent,
  contextReferences,
  warnings,
}: {
  session: WorkspaceAISession
  runtimeResponse: AIRuntimeResponse
  requestedIntent: WorkspaceIntelligenceIntent
  contextReferences: WorkspaceAIContextReference[]
  warnings: WorkspaceAIWarning[]
}): WorkspaceAISession {
  const updatedContext = normalizeContextReferences([
    ...session.currentContext,
    ...contextReferences,
  ])
  return {
    ...session,
    currentIntent: requestedIntent,
    currentContext: updatedContext,
    currentProviderUsage: {
      knowledgeProviderIds: runtimeResponse.providerUsage.knowledgeProviderIds,
      llmProviderId: runtimeResponse.providerUsage.llmProviderId,
      toolIds: runtimeResponse.toolUsage.eligibleToolIds,
    },
    currentRuntimeState: {
      status: runtimeResponse.validation.valid
        ? runtimeResponse.providerOutcome === 'generated'
          ? 'completed'
          : 'completedWithFallback'
        : 'failed',
      lastRuntimeRequestId: runtimeResponse.requestId,
      lastRuntimeEventTypes: runtimeResponse.events.map((event) => event.type),
      warnings,
    },
    updatedAt: runtimeResponse.events.at(-1)?.createdAt ?? session.updatedAt,
  }
}

function buildWorkspaceAIReferences({
  runtimeResponse,
  contextReferences,
}: {
  runtimeResponse: AIRuntimeResponse
  contextReferences: WorkspaceAIContextReference[]
}): WorkspaceAIReference[] {
  const context = contextReferences.map(
    (reference): WorkspaceAIReference => ({
      id: `workspace-ai-reference:context:${reference.id}`,
      label: reference.label,
      providerId: reference.providerId,
      source: 'entry-point-context',
      contextReference: reference,
    }),
  )
  const knowledge = runtimeResponse.knowledgeReferences.map(
    (reference): WorkspaceAIReference => ({
      id: `workspace-ai-reference:knowledge:${reference.id}`,
      label: reference.label,
      providerId: reference.providerId,
      source: 'workspace-intelligence',
      knowledgeReference: reference,
    }),
  )
  return [...context, ...knowledge].sort((first, second) =>
    first.id.localeCompare(second.id),
  )
}

function normalizeContextReferences(
  references: WorkspaceAIContextReference[],
): WorkspaceAIContextReference[] {
  return [
    ...new Map(
      references.map((reference) => [reference.id, reference]),
    ).values(),
  ].sort((first, second) => first.id.localeCompare(second.id))
}

export function normalizeWorkspaceAIRuntimeResponse({
  runtimeResponse,
  requestedIntent,
  fallbackRequestId,
}: {
  runtimeResponse: unknown
  requestedIntent: WorkspaceIntelligenceIntent
  fallbackRequestId: string
}): {
  runtimeResponse: AIRuntimeResponse
  normalization: WorkspaceAIResponseNormalization
} {
  const repairs: string[] = []
  const source = asRecord(runtimeResponse, repairs, 'runtimeResponse')
  const structuredSource = asRecord(
    source.structuredResponse,
    repairs,
    'runtimeResponse.structuredResponse',
  )
  const validationSource = asRecord(
    source.validation,
    repairs,
    'runtimeResponse.validation',
  )
  const providerUsageSource = asRecord(
    source.providerUsage,
    repairs,
    'runtimeResponse.providerUsage',
  )
  const toolUsageSource = asRecord(
    source.toolUsage,
    repairs,
    'runtimeResponse.toolUsage',
  )
  const outputType = normalizeOutputType(
    structuredSource.type ?? source.responseType,
    repairs,
    'runtimeResponse.structuredResponse.type',
  )
  const intent =
    readString(source.intent, repairs, 'runtimeResponse.intent') ??
    requestedIntent
  const normalizedIntent = intent as WorkspaceIntelligenceIntent
  const confidence = normalizeConfidence(
    source.confidence ?? structuredSource.confidence,
    repairs,
    'runtimeResponse.confidence',
  )

  const normalizedStructuredResponse: StructuredAIOutput = {
    intent: normalizedIntent,
    type: outputType,
    confidence: normalizeConfidence(
      structuredSource.confidence ?? confidence,
      repairs,
      'runtimeResponse.structuredResponse.confidence',
    ),
    answer: normalizeAnswer(structuredSource.answer, repairs),
    recommendations: normalizeArray<WorkspaceRecommendation>(
      structuredSource.recommendations,
      repairs,
      'runtimeResponse.structuredResponse.recommendations',
    ),
    actionProposals: normalizeActionProposals(
      structuredSource.actionProposals,
      repairs,
      'runtimeResponse.structuredResponse.actionProposals',
    ),
    toolRequests: normalizeArray(
      structuredSource.toolRequests,
      repairs,
      'runtimeResponse.structuredResponse.toolRequests',
    ),
    reasoningSummary:
      readString(
        structuredSource.reasoningSummary,
        repairs,
        'runtimeResponse.structuredResponse.reasoningSummary',
      ) ?? '',
    warnings: normalizeWarnings(
      structuredSource.warnings,
      repairs,
      'runtimeResponse.structuredResponse.warnings',
    ),
    citations: normalizeArray<WorkspaceKnowledgeReference>(
      structuredSource.citations,
      repairs,
      'runtimeResponse.structuredResponse.citations',
    ),
    followUpSuggestions: normalizeStringArray(
      structuredSource.followUpSuggestions,
      repairs,
      'runtimeResponse.structuredResponse.followUpSuggestions',
    ),
    executionRequests: normalizeArray(
      structuredSource.executionRequests,
      repairs,
      'runtimeResponse.structuredResponse.executionRequests',
    ),
  }

  const normalizedRuntimeResponse: AIRuntimeResponse = {
    ...(source as Partial<AIRuntimeResponse>),
    requestId:
      readString(source.requestId, repairs, 'runtimeResponse.requestId') ??
      fallbackRequestId,
    intent: normalizedIntent,
    confidence,
    providerUsage: {
      knowledgeProviderIds: normalizeStringArray(
        providerUsageSource.knowledgeProviderIds,
        repairs,
        'runtimeResponse.providerUsage.knowledgeProviderIds',
      ) as WorkspaceKnowledgeProviderId[],
      llmProviderId: readString(
        providerUsageSource.llmProviderId,
        repairs,
        'runtimeResponse.providerUsage.llmProviderId',
      ),
    },
    toolUsage: {
      eligibleToolIds: normalizeStringArray(
        toolUsageSource.eligibleToolIds,
        repairs,
        'runtimeResponse.toolUsage.eligibleToolIds',
      ),
      requestedToolIds: normalizeStringArray(
        toolUsageSource.requestedToolIds,
        repairs,
        'runtimeResponse.toolUsage.requestedToolIds',
      ),
      executedToolIds: normalizeStringArray(
        toolUsageSource.executedToolIds,
        repairs,
        'runtimeResponse.toolUsage.executedToolIds',
      ) as [],
    },
    knowledgeReferences: normalizeArray<WorkspaceKnowledgeReference>(
      source.knowledgeReferences,
      repairs,
      'runtimeResponse.knowledgeReferences',
    ),
    structuredResponse: normalizedStructuredResponse,
    recommendedActions: normalizeActionProposals(
      source.recommendedActions,
      repairs,
      'runtimeResponse.recommendedActions',
    ),
    warnings: normalizeWarnings(
      source.warnings,
      repairs,
      'runtimeResponse.warnings',
    ),
    citations: normalizeArray<WorkspaceKnowledgeReference>(
      source.citations,
      repairs,
      'runtimeResponse.citations',
    ),
    followUpSuggestions: normalizeStringArray(
      source.followUpSuggestions,
      repairs,
      'runtimeResponse.followUpSuggestions',
    ),
    executionRequests: normalizeArray(
      source.executionRequests,
      repairs,
      'runtimeResponse.executionRequests',
    ) as [],
    prompt: (source.prompt && typeof source.prompt === 'object'
      ? source.prompt
      : {}) as StructuredPrompt,
    aiRequest: (source.aiRequest && typeof source.aiRequest === 'object'
      ? source.aiRequest
      : {}) as StructuredAIRequest,
    reasoningSnapshot: (source.reasoningSnapshot &&
    typeof source.reasoningSnapshot === 'object'
      ? source.reasoningSnapshot
      : {}) as AIRuntimeResponse['reasoningSnapshot'],
    validation: {
      valid: readBoolean(
        validationSource.valid,
        repairs,
        'runtimeResponse.validation.valid',
      ),
      errors: normalizeWarnings(
        validationSource.errors,
        repairs,
        'runtimeResponse.validation.errors',
      ),
      warnings: normalizeWarnings(
        validationSource.warnings,
        repairs,
        'runtimeResponse.validation.warnings',
      ),
      rejectedActionProposals: normalizeActionProposals(
        validationSource.rejectedActionProposals,
        repairs,
        'runtimeResponse.validation.rejectedActionProposals',
      ),
    },
    providerOutcome: normalizeProviderOutcome(
      source.providerOutcome,
      repairs,
      'runtimeResponse.providerOutcome',
    ),
    events: normalizeArray<AIRuntimeResponse['events'][number]>(
      source.events,
      repairs,
      'runtimeResponse.events',
    ),
  }

  const normalization = {
    repaired: repairs.length > 0,
    repairCount: repairs.length,
    repairs,
    developerNotice: repairs.length
      ? `Workspace AI response normalized (${repairs.length} repair${repairs.length === 1 ? '' : 's'} applied).`
      : undefined,
  }

  return { runtimeResponse: normalizedRuntimeResponse, normalization }
}

function asRecord(
  value: unknown,
  repairs: string[],
  path: string,
): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  repairs.push(`${path}: object defaulted`)
  return {}
}

function normalizeArray<T>(
  value: unknown,
  repairs: string[],
  path: string,
): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value === undefined || value === null) {
    repairs.push(`${path}: [] defaulted`)
    return []
  }
  repairs.push(`${path}: malformed array dropped`)
  return []
}

function normalizeStringArray(
  value: unknown,
  repairs: string[],
  path: string,
): string[] {
  return normalizeArray<unknown>(value, repairs, path)
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function readString(
  value: unknown,
  repairs: string[],
  path: string,
): string | undefined {
  if (typeof value === 'string') return value.trim()
  if (value === undefined || value === null) {
    repairs.push(`${path}: "" defaulted`)
    return undefined
  }
  repairs.push(`${path}: non-string value ignored`)
  return undefined
}

function readBoolean(value: unknown, repairs: string[], path: string): boolean {
  if (typeof value === 'boolean') return value
  repairs.push(`${path}: false defaulted`)
  return false
}

function normalizeWarnings(
  value: unknown,
  repairs: string[],
  path: string,
): AIRuntimeResponse['warnings'] {
  return normalizeArray<unknown>(value, repairs, path).map((item, index) => {
    const record =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
    if (!Object.keys(record).length) {
      repairs.push(`${path}.${index}: warning object defaulted`)
    }
    return {
      code: typeof record.code === 'string' ? record.code : 'unknown',
      message: typeof record.message === 'string' ? record.message : '',
      severity:
        record.severity === 'info' ||
        record.severity === 'warning' ||
        record.severity === 'blocking'
          ? record.severity
          : 'info',
    }
  })
}

function normalizeActionProposals(
  value: unknown,
  repairs: string[],
  path: string,
): ActionProposal[] {
  return normalizeArray<unknown>(value, repairs, path).map((item, index) => {
    const record =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Partial<ActionProposal>)
        : {}
    if (!Object.keys(record).length) {
      repairs.push(`${path}.${index}: proposal object defaulted`)
    }
    return {
      ...record,
      id:
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `proposal-${index}`,
      actionType:
        typeof record.actionType === 'string' ? record.actionType : 'unknown',
      label: typeof record.label === 'string' ? record.label : '',
      targetProviderId: record.targetProviderId,
      confidence: normalizeConfidence(
        record.confidence,
        repairs,
        `${path}.${index}.confidence`,
      ),
      reasonCodes: Array.isArray(record.reasonCodes) ? record.reasonCodes : [],
      expectedImpact: Array.isArray(record.expectedImpact)
        ? record.expectedImpact
        : [],
      warnings: Array.isArray(record.warnings) ? record.warnings : [],
      parameters:
        record.parameters && typeof record.parameters === 'object'
          ? record.parameters
          : undefined,
      references: Array.isArray(record.references) ? record.references : [],
    }
  })
}

function normalizeAnswer(value: unknown, repairs: string[]) {
  if (value === undefined || value === null) return undefined
  const answer = asRecord(
    value,
    repairs,
    'runtimeResponse.structuredResponse.answer',
  )
  return {
    summary: typeof answer.summary === 'string' ? answer.summary : '',
    details: normalizeStringArray(
      answer.details,
      repairs,
      'runtimeResponse.structuredResponse.answer.details',
    ),
  }
}

function normalizeConfidence(
  value: unknown,
  repairs: string[],
  path: string,
): AIRuntimeConfidence {
  if (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'unknown'
  ) {
    return value
  }
  repairs.push(`${path}: unknown defaulted`)
  return 'unknown'
}

function normalizeOutputType(
  value: unknown,
  repairs: string[],
  path: string,
): AIRuntimeOutputType {
  if (
    value === 'answer' ||
    value === 'recommendations' ||
    value === 'actionProposals' ||
    value === 'explanation' ||
    value === 'summary' ||
    value === 'analysis'
  ) {
    return value
  }
  repairs.push(`${path}: answer defaulted`)
  return 'answer'
}

function normalizeProviderOutcome(
  value: unknown,
  repairs: string[],
  path: string,
): AIRuntimeResponse['providerOutcome'] {
  if (
    value === 'generated' ||
    value === 'deterministicFallback' ||
    value === 'clarification' ||
    value === 'partial' ||
    value === 'providerTimeout' ||
    value === 'providerUnavailable' ||
    value === 'validationFallback' ||
    value === 'failed'
  ) {
    return value
  }
  repairs.push(`${path}: deterministicFallback defaulted`)
  return 'deterministicFallback'
}

function createWorkspaceAIExperienceInstrumentation({
  requestId,
  runtimeRequestId,
}: {
  requestId: string
  runtimeRequestId?: string
}) {
  return {
    run<T>(
      builder: WorkspaceAIExperienceBuilderName,
      objectSummary: {
        value: unknown
        expectedKeys?: string[]
      },
      build: () => T,
    ): T {
      traceWorkspaceAIExperienceBuilder({
        event: 'BEGIN',
        requestId,
        runtimeRequestId,
        builder,
        value: objectSummary.value,
        expectedKeys: objectSummary.expectedKeys,
      })
      try {
        const result = build()
        traceWorkspaceAIExperienceBuilder({
          event: 'END',
          requestId,
          runtimeRequestId,
          builder,
          value: result,
        })
        return result
      } catch (error) {
        const diagnostic = buildWorkspaceAIExperienceBuilderDiagnostic({
          requestId,
          runtimeRequestId,
          builder,
          value: objectSummary.value,
          expectedKeys: objectSummary.expectedKeys,
          error,
        })
        traceWorkspaceAIExperienceBuilder({
          event: 'FAILED',
          requestId,
          runtimeRequestId,
          builder,
          value: objectSummary.value,
          expectedKeys: objectSummary.expectedKeys,
          error,
          diagnostic,
        })
        throw new WorkspaceAIExperienceAssemblyError({
          diagnostic,
          cause: error,
        })
      }
    },
  }
}

function traceWorkspaceAIExperienceBuilder({
  event,
  requestId,
  runtimeRequestId,
  builder,
  value,
  expectedKeys,
  error,
  diagnostic,
}: {
  event: 'BEGIN' | 'END' | 'FAILED'
  requestId: string
  runtimeRequestId?: string
  builder: WorkspaceAIExperienceBuilderName
  value: unknown
  expectedKeys?: string[]
  error?: unknown
  diagnostic?: WorkspaceAIExperienceBuilderDiagnostic
}) {
  if (process.env.NODE_ENV !== 'development') return
  const object = summarizeDiagnosticObject(value, expectedKeys)
  console.info(`[WorkspaceAIExperience] ${event} ${builder}`, {
    requestId,
    runtimeRequestId,
    builder,
    objectType: object.failingObjectType,
    objectKeys: object.objectKeys,
    sampleKeys: object.sampleKeys,
    missingKeys: object.missingKeys,
    exceptionClass: error instanceof Error ? error.constructor.name : undefined,
    exceptionMessage: error instanceof Error ? error.message : undefined,
    diagnostic,
    timestamp: new Date().toISOString(),
  })
}

function buildWorkspaceAIExperienceBuilderDiagnostic({
  requestId,
  runtimeRequestId,
  builder,
  value,
  expectedKeys,
  error,
}: {
  requestId: string
  runtimeRequestId?: string
  builder: WorkspaceAIExperienceBuilderName
  value: unknown
  expectedKeys?: string[]
  error: unknown
}): WorkspaceAIExperienceBuilderDiagnostic {
  const object = summarizeDiagnosticObject(value, expectedKeys)
  const stack = error instanceof Error ? error.stack : undefined
  const location = extractWorkspaceAIExperienceLocation(stack)
  return {
    requestId,
    runtimeRequestId,
    builder,
    functionName: builder,
    file: location.file,
    line: location.line,
    exceptionClass:
      error instanceof Error ? error.constructor.name : typeof error,
    exceptionMessage: error instanceof Error ? error.message : String(error),
    stack,
    failingObjectType: object.failingObjectType,
    objectKeys: object.objectKeys,
    sampleKeys: object.sampleKeys,
    missingKeys: object.missingKeys,
    missingProperty: extractMissingProperty(error),
    timestamp: new Date().toISOString(),
  }
}

function summarizeDiagnosticObject(
  value: unknown,
  expectedKeys: string[] = [],
) {
  const objectKeys = getDiagnosticObjectKeys(value)
  const sampleKeys =
    Array.isArray(value) && value[0] !== undefined
      ? getDiagnosticObjectKeys(value[0])
      : undefined
  const keysForMissingCheck = Array.isArray(value)
    ? (sampleKeys ?? [])
    : objectKeys
  return {
    failingObjectType: diagnosticObjectType(value),
    objectKeys,
    sampleKeys,
    missingKeys: expectedKeys.filter(
      (key) => !keysForMissingCheck.includes(key),
    ),
  }
}

function diagnosticObjectType(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`
  if (value === null) return 'null'
  if (value instanceof Date) return 'Date'
  return typeof value
}

function getDiagnosticObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.length ? ['length', '0'] : ['length']
  }
  return Object.keys(value).sort()
}

function extractWorkspaceAIExperienceLocation(stack: string | undefined): {
  file: string
  line?: number
} {
  if (!stack) return { file: 'lib/ai/experience/workspaceAIExperience.ts' }
  const frame = stack
    .split('\n')
    .map((line) => line.trim())
    .find(
      (line) =>
        line.includes('workspaceAIExperience.ts') ||
        line.includes('operationalIntelligence.ts'),
    )
  if (!frame) return { file: 'lib/ai/experience/workspaceAIExperience.ts' }
  const match = frame.match(
    /((?:lib|app|components)\/[^():]+\.tsx?|\/Users\/[^():]+\.tsx?):(\d+):\d+/,
  )
  if (!match) return { file: frame }
  const rawFile = match[1]
  return {
    file: rawFile.includes('/Users/') ? rawFile : rawFile,
    line: Number(match[2]),
  }
}

function extractMissingProperty(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  const propertyMatch = error.message.match(/(?:property|properties) '([^']+)'/)
  if (propertyMatch?.[1]) return propertyMatch[1]
  const readMatch = error.message.match(/reading '([^']+)'/)
  return readMatch?.[1]
}

function requiredEntryPoint(
  registry: WorkspaceAIEntryPointRegistry,
  entryPointId: WorkspaceAIEntryPointId,
) {
  const entryPoint = registry.get(entryPointId)
  if (!entryPoint) {
    throw new Error(
      `Workspace AI entry point ${entryPointId} is not registered.`,
    )
  }
  return entryPoint
}

export function createWorkspaceAIExperience() {
  return {
    entryPointRegistry: workspaceAIEntryPointRegistry,
    runtimeRegistry: workspaceAIRuntimeRegistry,
    createSession: createWorkspaceAISession,
    runRequest: runWorkspaceAIRequest,
  }
}

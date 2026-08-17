import { buildOperationalHistoryInspection } from '@/lib/ai/operational/operationalHistory'

export type AIPlaygroundFailureStage =
  | 'request'
  | 'authorization'
  | 'entryPointResolution'
  | 'intentResolution'
  | 'contextAssembly'
  | 'knowledgeLoad'
  | 'reasoningPreparation'
  | 'providerRequestBuild'
  | 'aiExperienceRun'
  | 'provider'
  | 'providerNormalization'
  | 'responseValidation'
  | 'operationalIntelligenceBuild'
  | 'operationalIntelligencePersist'
  | 'operationalHistoryAggregation'
  | 'developerInspection'
  | 'responseSerialization'
  | 'unknown'

export type AIPlaygroundSafeCode =
  | 'PLAYGROUND_REQUEST_INVALID'
  | 'REQUEST_VALIDATION_FAILED'
  | 'AUTHORIZATION_FAILED'
  | 'ENTRY_POINT_RESOLUTION_FAILED'
  | 'INTENT_RESOLUTION_FAILED'
  | 'CONTEXT_ASSEMBLY_FAILED'
  | 'KNOWLEDGE_LOAD_FAILED'
  | 'REASONING_PREPARATION_FAILED'
  | 'PROVIDER_REQUEST_BUILD_FAILED'
  | 'AI_EXPERIENCE_RUN_FAILED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'OPENAI_API_KEY_MISSING'
  | 'OPENAI_PROVIDER_DISABLED'
  | 'OPENAI_MODEL_INVALID'
  | 'OPENAI_CLIENT_INITIALIZATION_FAILED'
  | 'OPENAI_REQUEST_BUILD_FAILED'
  | 'OPENAI_TIMEOUT'
  | 'OPENAI_NETWORK_ERROR'
  | 'OPENAI_AUTHENTICATION_FAILED'
  | 'OPENAI_RATE_LIMITED'
  | 'OPENAI_PROVIDER_UNAVAILABLE'
  | 'OPENAI_UNKNOWN_FAILURE'
  | 'PROVIDER_NORMALIZATION_FAILED'
  | 'RESPONSE_VALIDATION_FAILED'
  | 'OPERATIONAL_INTELLIGENCE_BUILD_FAILED'
  | 'OPERATIONAL_INTELLIGENCE_PERSIST_FAILED'
  | 'OPERATIONAL_HISTORY_AGGREGATION_FAILED'
  | 'DEVELOPER_INSPECTION_FAILED'
  | 'RESPONSE_SERIALIZATION_FAILED'
  | 'CLIENT_RESPONSE_PARSE_FAILED'
  | 'UNKNOWN_PLAYGROUND_FAILURE'

export type AIPlaygroundRequestStage =
  | 'REQUEST_RECEIVED'
  | 'REQUEST_VALIDATED'
  | 'AUTHORIZED'
  | 'ENTRY_POINT_RESOLVED'
  | 'INTENT_RESOLVED'
  | 'CONTEXT_ASSEMBLED'
  | 'KNOWLEDGE_LOADED'
  | 'REASONING_PREPARED'
  | 'PROVIDER_REQUEST_BUILT'
  | 'AI_EXPERIENCE_RUN'
  | 'PROVIDER_INVOKED'
  | 'PROVIDER_NORMALIZED'
  | 'RESPONSE_VALIDATED'
  | 'OPERATIONAL_INTELLIGENCE_BUILT'
  | 'OPERATIONAL_PERSISTENCE_STARTED'
  | 'OPERATIONAL_PERSISTENCE_COMPLETED'
  | 'DEVELOPER_INSPECTION_BUILT'
  | 'RESPONSE_SERIALIZED'
  | 'RESPONSE_RETURNED'

export type AIPlaygroundStageCheckpoint = {
  stage: AIPlaygroundRequestStage
  startedAt: string
  completedAt?: string
  durationMs?: number
}

export type AIPlaygroundDiagnostic = {
  requestId: string
  failureStage: AIPlaygroundFailureStage
  safeCode: AIPlaygroundSafeCode
  safeMessage: string
  retryable: boolean
  responseGenerated: boolean
  persistenceAttempted: boolean
  persistenceSucceeded: boolean
  providerOutcome?: string
  lastCompletedStage?: AIPlaygroundRequestStage
  nextExpectedStage?: AIPlaygroundRequestStage
  completedStages?: AIPlaygroundRequestStage[]
  stageTimeline?: AIPlaygroundStageCheckpoint[]
  workspaceAIExperience?: AIPlaygroundWorkspaceAIExperienceDiagnostic
  timestamp: string
}

export type AIPlaygroundWorkspaceAIExperienceDiagnostic = {
  requestId: string
  runtimeRequestId?: string
  builder: string
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

export type AIPlaygroundOperationalInspection = {
  operationalIntelligence: unknown
  operationalInsights?: unknown
  decisionExplanation?: unknown
  businessRulesApplied?: unknown
  rejectedAlternatives?: unknown
  evidenceRanking?: unknown
  knowledgeEffectiveness?: unknown
  insightGeneration?: unknown
  recommendationJustification?: unknown
  operationalHealth?: unknown
  futureDashboardSignals?: unknown
  operationalHistory?: unknown
  operationalTrends?: unknown
  insightLifecycle?: unknown
  recurringRisks?: unknown
  recommendationOutcomes?: unknown
  dashboardSignals?: unknown
  operationalTimeline?: unknown
  healthEvolution?: unknown
  trendGraphData?: unknown
  operationalConfidence?: unknown
  operationalPersistence: {
    mode: 'previewOnly'
    source: 'INTERNAL_PLAYGROUND'
    persistenceAttempted: false
    persistenceSucceeded: false
  }
  playgroundDiagnostics: AIPlaygroundDiagnostic[]
}

export function createAIPlaygroundDiagnostic({
  requestId,
  failureStage,
  safeCode,
  safeMessage,
  retryable,
  responseGenerated,
  persistenceAttempted = false,
  persistenceSucceeded = false,
  providerOutcome,
  lastCompletedStage,
  nextExpectedStage,
  completedStages,
  stageTimeline,
  workspaceAIExperience,
  timestamp = new Date().toISOString(),
}: {
  requestId: string
  failureStage: AIPlaygroundFailureStage
  safeCode: AIPlaygroundSafeCode
  safeMessage: string
  retryable: boolean
  responseGenerated: boolean
  persistenceAttempted?: boolean
  persistenceSucceeded?: boolean
  providerOutcome?: string
  lastCompletedStage?: AIPlaygroundRequestStage
  nextExpectedStage?: AIPlaygroundRequestStage
  completedStages?: AIPlaygroundRequestStage[]
  stageTimeline?: AIPlaygroundStageCheckpoint[]
  workspaceAIExperience?: AIPlaygroundWorkspaceAIExperienceDiagnostic
  timestamp?: string
}): AIPlaygroundDiagnostic {
  return {
    requestId,
    failureStage,
    safeCode,
    safeMessage,
    retryable,
    responseGenerated,
    persistenceAttempted,
    persistenceSucceeded,
    providerOutcome,
    lastCompletedStage,
    nextExpectedStage,
    completedStages,
    stageTimeline,
    workspaceAIExperience,
    timestamp,
  }
}

export function createAIPlaygroundStageTracker({
  requestId,
  now = () => Date.now(),
}: {
  requestId: string
  now?: () => number
}) {
  let currentRequestId = requestId
  let currentStage: AIPlaygroundRequestStage | undefined
  const completedStages: AIPlaygroundRequestStage[] = []
  const timeline: Array<AIPlaygroundStageCheckpoint & { startedMs: number }> =
    []

  function enter(stage: AIPlaygroundRequestStage) {
    currentStage = stage
    timeline.push({
      stage,
      startedAt: new Date(now()).toISOString(),
      startedMs: now(),
    })
  }

  function complete(
    stage: AIPlaygroundRequestStage = currentStage as AIPlaygroundRequestStage,
  ) {
    if (!stage) return
    const completedMs = now()
    const checkpoint = [...timeline]
      .reverse()
      .find((item) => item.stage === stage && !item.completedAt)
    if (checkpoint) {
      checkpoint.completedAt = new Date(completedMs).toISOString()
      checkpoint.durationMs = Math.max(0, completedMs - checkpoint.startedMs)
    }
    if (!completedStages.includes(stage)) completedStages.push(stage)
    if (currentStage === stage) currentStage = undefined
  }

  return {
    setRequestId(nextRequestId: string) {
      currentRequestId = nextRequestId
    },
    enter,
    complete,
    checkpoint(stage: AIPlaygroundRequestStage) {
      enter(stage)
      complete(stage)
    },
    snapshot() {
      return {
        requestId: currentRequestId,
        currentStage,
        completedStages: [...completedStages],
        lastCompletedStage: completedStages.at(-1),
        nextExpectedStage: nextExpectedStage(
          currentStage,
          completedStages.at(-1),
        ),
        timeline: timeline.map(({ startedMs: _startedMs, ...item }) => item),
      }
    },
  }
}

export function createAIPlaygroundDiagnosticFromStage({
  tracker,
  responseGenerated = false,
  persistenceAttempted = false,
  persistenceSucceeded = false,
  providerOutcome,
  workspaceAIExperience,
}: {
  tracker: ReturnType<typeof createAIPlaygroundStageTracker>
  responseGenerated?: boolean
  persistenceAttempted?: boolean
  persistenceSucceeded?: boolean
  providerOutcome?: string
  workspaceAIExperience?: AIPlaygroundWorkspaceAIExperienceDiagnostic
}) {
  const snapshot = tracker.snapshot()
  const mapping = diagnosticMapping(
    snapshot.currentStage ?? snapshot.nextExpectedStage ?? 'REQUEST_RECEIVED',
  )
  return createAIPlaygroundDiagnostic({
    requestId: snapshot.requestId,
    failureStage: mapping.failureStage,
    safeCode: mapping.safeCode,
    safeMessage: mapping.safeMessage,
    retryable: mapping.retryable,
    responseGenerated,
    persistenceAttempted,
    persistenceSucceeded,
    providerOutcome,
    lastCompletedStage: snapshot.lastCompletedStage,
    nextExpectedStage: snapshot.nextExpectedStage,
    completedStages: snapshot.completedStages,
    stageTimeline: snapshot.timeline,
    workspaceAIExperience,
  })
}

export function createAIPlaygroundDiagnosticFromProviderError({
  tracker,
  providerError,
  responseGenerated = false,
}: {
  tracker: ReturnType<typeof createAIPlaygroundStageTracker>
  providerError: {
    code: string
    message: string
    retryable: boolean
  }
  responseGenerated?: boolean
}) {
  const snapshot = tracker.snapshot()
  return createAIPlaygroundDiagnostic({
    requestId: snapshot.requestId,
    failureStage:
      providerError.code === 'OPENAI_REQUEST_BUILD_FAILED'
        ? 'providerRequestBuild'
        : 'provider',
    safeCode: normalizeProviderSafeCode(providerError.code),
    safeMessage: providerError.message,
    retryable: providerError.retryable,
    responseGenerated,
    persistenceAttempted: false,
    persistenceSucceeded: false,
    providerOutcome: providerError.code,
    lastCompletedStage: snapshot.lastCompletedStage,
    nextExpectedStage: snapshot.nextExpectedStage,
    completedStages: snapshot.completedStages,
    stageTimeline: snapshot.timeline,
  })
}

export function buildPlaygroundOperationalInspection({
  operationalIntelligence,
  requestId,
  providerOutcome,
  onInspectionError,
}: {
  operationalIntelligence: unknown
  requestId: string
  providerOutcome?: string
  onInspectionError?: (error: unknown) => void
}): AIPlaygroundOperationalInspection {
  const snapshot = isRecord(operationalIntelligence)
    ? operationalIntelligence
    : null
  const diagnostics: AIPlaygroundDiagnostic[] = []
  let historyInspection: ReturnType<
    typeof buildOperationalHistoryInspection
  > | null = null

  if (snapshot) {
    try {
      historyInspection = buildOperationalHistoryInspection({
        currentSnapshot: snapshot as any,
      })
    } catch (error) {
      onInspectionError?.(error)
      diagnostics.push(
        createAIPlaygroundDiagnostic({
          requestId,
          failureStage: 'developerInspection',
          safeCode: 'DEVELOPER_INSPECTION_FAILED',
          safeMessage:
            'The AI response completed, but developer inspection was partially unavailable.',
          retryable: false,
          responseGenerated: true,
          providerOutcome,
        }),
      )
    }
  }

  return {
    operationalIntelligence,
    operationalInsights: snapshot?.operationalInsights,
    decisionExplanation: snapshot?.decisionExplanations,
    businessRulesApplied: snapshot?.businessRulesApplied,
    rejectedAlternatives: snapshot?.rejectedAlternatives,
    evidenceRanking: snapshot?.evidenceRanking,
    knowledgeEffectiveness: snapshot?.knowledgeEffectiveness,
    insightGeneration: snapshot?.insightGeneration,
    recommendationJustification: snapshot?.recommendationJustifications,
    operationalHealth: snapshot?.operationalHealth,
    futureDashboardSignals: snapshot?.futureDashboardSignals,
    operationalHistory: historyInspection?.operationalHistory,
    operationalTrends: historyInspection?.operationalTrends,
    insightLifecycle: historyInspection?.insightLifecycle,
    recurringRisks: historyInspection?.recurringRisks,
    recommendationOutcomes: historyInspection?.recommendationOutcomes,
    dashboardSignals: historyInspection?.dashboardSignals,
    operationalTimeline: historyInspection?.operationalTimeline,
    healthEvolution: historyInspection?.healthEvolution,
    trendGraphData: historyInspection?.trendGraphData,
    operationalConfidence: historyInspection?.operationalConfidence,
    operationalPersistence: {
      mode: 'previewOnly',
      source: 'INTERNAL_PLAYGROUND',
      persistenceAttempted: false,
      persistenceSucceeded: false,
    },
    playgroundDiagnostics: diagnostics,
  }
}

export function buildAIPlaygroundFailurePayload({
  requestId,
  diagnostic,
  error = 'The internal playground request failed before a response was returned.',
}: {
  requestId: string
  diagnostic: AIPlaygroundDiagnostic
  error?: string
}) {
  return {
    ok: false,
    requestId,
    error,
    reason: diagnostic.safeMessage,
    diagnostic,
    inspection: {
      requestId,
      playgroundDiagnostics: [diagnostic],
      actionExecution: 'not-executed',
    },
  }
}

export function logAIPlaygroundServerError({
  requestId,
  stage,
  error,
  context,
}: {
  requestId: string
  stage: AIPlaygroundFailureStage
  error: unknown
  context?: Record<string, unknown>
}) {
  if (process.env.NODE_ENV !== 'development') return
  console.error('[AI_PLAYGROUND_REQUEST_FAILED]', {
    requestId,
    stage,
    ...context,
    errorClass: error instanceof Error ? error.constructor.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    prismaCode:
      isRecord(error) && typeof error.code === 'string'
        ? error.code
        : undefined,
    prismaMeta: sanitizePrismaMeta(error),
    timestamp: new Date().toISOString(),
  })
}

export function traceAIPlaygroundLifecycle({
  stage,
  requestId,
  startedAtMs,
  providerName,
  model,
  responseFormat,
  schemaIdentifier,
  sdkRequestAttempted,
  error,
  context,
}: {
  stage: string
  requestId: string
  startedAtMs?: number
  providerName?: string
  model?: string
  responseFormat?: string
  schemaIdentifier?: string
  sdkRequestAttempted?: boolean
  error?: unknown
  context?: Record<string, unknown>
}) {
  if (process.env.NODE_ENV !== 'development') return
  console.info('[AI_PLAYGROUND_TRACE]', {
    stage,
    requestId,
    elapsedMs:
      typeof startedAtMs === 'number'
        ? Math.max(0, Date.now() - startedAtMs)
        : undefined,
    providerName,
    model,
    responseFormat,
    schemaIdentifier,
    sdkRequestAttempted,
    ...context,
    exceptionClass: error instanceof Error ? error.constructor.name : undefined,
    exceptionMessage: error instanceof Error ? error.message : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nextExpectedStage(
  currentStage: AIPlaygroundRequestStage | undefined,
  lastCompletedStage: AIPlaygroundRequestStage | undefined,
): AIPlaygroundRequestStage | undefined {
  if (currentStage) return currentStage
  if (!lastCompletedStage) return 'REQUEST_RECEIVED'
  const index = stageOrder.indexOf(lastCompletedStage)
  return index >= 0 ? stageOrder[index + 1] : undefined
}

function diagnosticMapping(stage: AIPlaygroundRequestStage): {
  failureStage: AIPlaygroundFailureStage
  safeCode: AIPlaygroundSafeCode
  safeMessage: string
  retryable: boolean
} {
  switch (stage) {
    case 'REQUEST_RECEIVED':
    case 'REQUEST_VALIDATED':
      return {
        failureStage: 'request',
        safeCode: 'REQUEST_VALIDATION_FAILED',
        safeMessage: 'The playground request could not be validated.',
        retryable: false,
      }
    case 'AUTHORIZED':
      return {
        failureStage: 'authorization',
        safeCode: 'AUTHORIZATION_FAILED',
        safeMessage: 'The playground request could not be authorized.',
        retryable: false,
      }
    case 'ENTRY_POINT_RESOLVED':
      return {
        failureStage: 'entryPointResolution',
        safeCode: 'ENTRY_POINT_RESOLUTION_FAILED',
        safeMessage: 'The playground entry point could not be resolved.',
        retryable: false,
      }
    case 'INTENT_RESOLVED':
      return {
        failureStage: 'intentResolution',
        safeCode: 'INTENT_RESOLUTION_FAILED',
        safeMessage: 'The playground intent could not be resolved.',
        retryable: false,
      }
    case 'CONTEXT_ASSEMBLED':
      return {
        failureStage: 'contextAssembly',
        safeCode: 'CONTEXT_ASSEMBLY_FAILED',
        safeMessage:
          'Workspace context could not be assembled for the playground request.',
        retryable: true,
      }
    case 'KNOWLEDGE_LOADED':
      return {
        failureStage: 'knowledgeLoad',
        safeCode: 'KNOWLEDGE_LOAD_FAILED',
        safeMessage:
          'Workspace knowledge could not be loaded for the playground request.',
        retryable: true,
      }
    case 'REASONING_PREPARED':
      return {
        failureStage: 'reasoningPreparation',
        safeCode: 'REASONING_PREPARATION_FAILED',
        safeMessage: 'The reasoning snapshot could not be prepared.',
        retryable: true,
      }
    case 'PROVIDER_REQUEST_BUILT':
      return {
        failureStage: 'providerRequestBuild',
        safeCode: 'PROVIDER_REQUEST_BUILD_FAILED',
        safeMessage: 'The provider request could not be built.',
        retryable: false,
      }
    case 'AI_EXPERIENCE_RUN':
      return {
        failureStage: 'aiExperienceRun',
        safeCode: 'AI_EXPERIENCE_RUN_FAILED',
        safeMessage:
          'The Workspace AI experience failed while assembling the playground response.',
        retryable: true,
      }
    case 'PROVIDER_INVOKED':
      return {
        failureStage: 'provider',
        safeCode: 'PROVIDER_UNAVAILABLE',
        safeMessage: 'The AI provider did not return a usable response.',
        retryable: true,
      }
    case 'PROVIDER_NORMALIZED':
      return {
        failureStage: 'providerNormalization',
        safeCode: 'PROVIDER_NORMALIZATION_FAILED',
        safeMessage: 'The provider response could not be normalized.',
        retryable: true,
      }
    case 'RESPONSE_VALIDATED':
      return {
        failureStage: 'responseValidation',
        safeCode: 'RESPONSE_VALIDATION_FAILED',
        safeMessage: 'The Workspace AI response did not pass validation.',
        retryable: true,
      }
    case 'OPERATIONAL_INTELLIGENCE_BUILT':
      return {
        failureStage: 'operationalIntelligenceBuild',
        safeCode: 'OPERATIONAL_INTELLIGENCE_BUILD_FAILED',
        safeMessage: 'Operational Intelligence could not be generated.',
        retryable: true,
      }
    case 'OPERATIONAL_PERSISTENCE_STARTED':
    case 'OPERATIONAL_PERSISTENCE_COMPLETED':
      return {
        failureStage: 'operationalIntelligencePersist',
        safeCode: 'OPERATIONAL_INTELLIGENCE_PERSIST_FAILED',
        safeMessage:
          'The test Operational Intelligence snapshot could not be saved.',
        retryable: true,
      }
    case 'DEVELOPER_INSPECTION_BUILT':
      return {
        failureStage: 'developerInspection',
        safeCode: 'DEVELOPER_INSPECTION_FAILED',
        safeMessage: 'Developer inspection could not be assembled.',
        retryable: false,
      }
    case 'RESPONSE_SERIALIZED':
    case 'RESPONSE_RETURNED':
      return {
        failureStage: 'responseSerialization',
        safeCode: 'RESPONSE_SERIALIZATION_FAILED',
        safeMessage: 'The playground response could not be serialized.',
        retryable: true,
      }
  }
}

function normalizeProviderSafeCode(code: string): AIPlaygroundSafeCode {
  if (openAIProviderSafeCodes.has(code as AIPlaygroundSafeCode)) {
    return code as AIPlaygroundSafeCode
  }
  if (code === 'openai-timeout') return 'OPENAI_TIMEOUT'
  if (code === 'openai-disabled') return 'OPENAI_API_KEY_MISSING'
  if (code === 'openai-unavailable') return 'OPENAI_PROVIDER_UNAVAILABLE'
  if (code === 'openai-rate-limit') return 'OPENAI_RATE_LIMITED'
  if (code === 'openai-authentication') return 'OPENAI_AUTHENTICATION_FAILED'
  if (code === 'openai-bad-request') return 'OPENAI_REQUEST_BUILD_FAILED'
  return 'PROVIDER_UNAVAILABLE'
}

const openAIProviderSafeCodes = new Set<AIPlaygroundSafeCode>([
  'OPENAI_API_KEY_MISSING',
  'OPENAI_PROVIDER_DISABLED',
  'OPENAI_MODEL_INVALID',
  'OPENAI_CLIENT_INITIALIZATION_FAILED',
  'OPENAI_REQUEST_BUILD_FAILED',
  'OPENAI_TIMEOUT',
  'OPENAI_NETWORK_ERROR',
  'OPENAI_AUTHENTICATION_FAILED',
  'OPENAI_RATE_LIMITED',
  'OPENAI_PROVIDER_UNAVAILABLE',
  'OPENAI_UNKNOWN_FAILURE',
])

const stageOrder: AIPlaygroundRequestStage[] = [
  'REQUEST_RECEIVED',
  'REQUEST_VALIDATED',
  'AUTHORIZED',
  'ENTRY_POINT_RESOLVED',
  'INTENT_RESOLVED',
  'CONTEXT_ASSEMBLED',
  'KNOWLEDGE_LOADED',
  'REASONING_PREPARED',
  'PROVIDER_REQUEST_BUILT',
  'AI_EXPERIENCE_RUN',
  'PROVIDER_INVOKED',
  'PROVIDER_NORMALIZED',
  'RESPONSE_VALIDATED',
  'OPERATIONAL_INTELLIGENCE_BUILT',
  'OPERATIONAL_PERSISTENCE_STARTED',
  'OPERATIONAL_PERSISTENCE_COMPLETED',
  'DEVELOPER_INSPECTION_BUILT',
  'RESPONSE_SERIALIZED',
  'RESPONSE_RETURNED',
]

function sanitizePrismaMeta(error: unknown) {
  if (!isRecord(error) || !isRecord(error.meta)) return undefined
  return Object.fromEntries(
    Object.entries(error.meta)
      .filter(
        ([key]) => !/(sql|query|database|url|password|secret|token)/i.test(key),
      )
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? value.slice(0, 300) : value,
      ]),
  )
}

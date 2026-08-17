import {
  assembleContext,
  createKnowledgeProviderRegistry,
  resolveIntent,
  workspaceIntelligenceToolRegistry,
  workspaceKnowledgeProviderRegistry,
  type KnowledgeProviderMetadata,
  type KnowledgeProviderRegistry,
  type WorkspaceContextAssemblerResult,
  type WorkspaceIntelligenceActor,
  type WorkspaceIntelligenceCapabilityKey,
  type WorkspaceIntelligenceIntent,
  type WorkspaceIntelligenceWorkspace,
  type WorkspaceKnowledgeProviderId,
  type WorkspaceKnowledgeReference,
  type WorkspaceRecommendation,
  type WorkspaceToolMetadata,
} from '@/lib/intelligence/workspaceIntelligence'
import {
  createAIProviderRegistry,
  isAIProviderException,
  type AIProvider,
  type AIProviderRegistry,
} from '@/lib/ai/providers/aiProviderLayer'
import { normalizeValidatedCitationIds } from '@/lib/ai/runtime/citations'
import {
  buildWorkspaceReasoningSnapshot,
  type WorkspaceReasoningSnapshot,
} from '@/lib/ai/reasoning/workspaceReasoningEngine'

export type AIRuntimeExecutionMode = 'prepareOnly' | 'modelDraft'

export type AIRuntimeOutputType =
  | 'answer'
  | 'recommendations'
  | 'actionProposals'
  | 'explanation'
  | 'summary'
  | 'analysis'

export type AIRuntimeConfidence = 'low' | 'medium' | 'high' | 'unknown'

export type AIRuntimeProviderOutcome =
  | 'generated'
  | 'deterministicFallback'
  | 'clarification'
  | 'partial'
  | 'providerTimeout'
  | 'providerUnavailable'
  | 'validationFallback'
  | 'failed'

export type ConversationMetadata = {
  conversationId?: string
  turnId?: string
  parentTurnId?: string
  channel?:
    | 'workspace-chat'
    | 'scheduling-assistant'
    | 'workflow-builder'
    | 'api'
    | 'unknown'
}

export type ConversationTurn = {
  id: string
  role: 'user' | 'assistant' | 'system'
  createdAt: string
  contentReferenceId?: string
  metadata?: Record<string, unknown>
}

export type ConversationRequest = {
  metadata?: ConversationMetadata
  turns?: ConversationTurn[]
}

export type ConversationResponse = {
  metadata?: ConversationMetadata
  turn?: ConversationTurn
}

export type AIRuntimeRequest = {
  id: string
  actor: WorkspaceIntelligenceActor
  workspace: WorkspaceIntelligenceWorkspace
  requestedIntent?: WorkspaceIntelligenceIntent
  intentHint?: {
    domain?: Parameters<typeof resolveIntent>[0]['domain']
    action?: string
  }
  conversation?: ConversationRequest
  requestedCapabilities?: WorkspaceIntelligenceCapabilityKey[]
  allowedToolIds?: string[]
  requestedProviderIds?: WorkspaceKnowledgeProviderId[]
  requestedOutputType: AIRuntimeOutputType
  executionMode: AIRuntimeExecutionMode
  llmProviderId?: string
  providerSources?: Partial<Record<WorkspaceKnowledgeProviderId, unknown>>
  governedKnowledge?: AIRuntimeGovernedKnowledge
  allowedActionTypes?: string[]
  now?: Date
  constraints?: string[]
}

export type AIRuntimeGovernedKnowledge = {
  approvedKnowledge: unknown[]
  knowledgeGaps: unknown[]
  confidence?: unknown
  correctionsMetadata: unknown[]
  recommendationHistory: unknown[]
  runtimeKnowledgeFingerprint?: string
  runtimeKnowledgePolicy?: 'approved-active-only'
}

export type AIProviderCapabilities = AIProvider['capabilities']

export type StructuredPrompt = {
  intent: WorkspaceIntelligenceIntent
  systemContext: {
    runtime: 'WorkspaceAIRuntime'
    version: 'foundation'
    executionBoundary: 'propose-only'
  }
  workspaceContext: WorkspaceContextAssemblerResult['context']
  workspaceState: WorkspaceContextAssemblerResult['state']
  reasoningSnapshot: WorkspaceReasoningSnapshot
  knowledgeReferences: WorkspaceKnowledgeReference[]
  toolMetadata: WorkspaceToolMetadata[]
  governedKnowledge?: AIRuntimeGovernedKnowledge
  requestedOutput: {
    type: AIRuntimeOutputType
    capabilities: WorkspaceIntelligenceCapabilityKey[]
  }
  constraints: string[]
}

export type StructuredAIRequest = {
  id: string
  intent: WorkspaceIntelligenceIntent
  prompt: StructuredPrompt
  outputSchema: StructuredOutputSchema
  allowedTools: WorkspaceToolMetadata[]
  knowledgeProviderMetadata: KnowledgeProviderMetadata[]
}

export type StructuredOutputSchema = {
  type: AIRuntimeOutputType
  requiredFields: Array<keyof StructuredAIOutput>
  supportsActionProposals: boolean
  supportsToolRequests: boolean
}

export type StructuredAIOutput = {
  intent: WorkspaceIntelligenceIntent
  type: AIRuntimeOutputType
  confidence: AIRuntimeConfidence
  answer?: {
    summary: string
    details?: string[]
  }
  recommendations?: WorkspaceRecommendation[]
  actionProposals?: ActionProposal[]
  toolRequests?: ToolRequest[]
  reasoningSummary?: string
  warnings?: AIRuntimeWarning[]
  citations?: WorkspaceKnowledgeReference[]
  followUpSuggestions?: string[]
  executionRequests?: unknown[]
}

export type ActionProposal = {
  id: string
  actionType: string
  label: string
  summary?: string
  targetProviderId?: WorkspaceKnowledgeProviderId
  target?: {
    recordType: string
    recordId: string
    label: string
    detail?: string
  }
  currentState?: string
  proposedState?: string
  reasonCodes?: string[]
  explanation?: string
  expectedImpact?: string[]
  warnings?: string[]
  validation?: {
    status: 'valid' | 'incomplete'
    missingFields?: string[]
    message?: string
  }
  requiredToolId?: string
  parameters?: Record<string, unknown>
  confidence: AIRuntimeConfidence
  references: WorkspaceKnowledgeReference[]
}

export type ToolRequest = {
  id: string
  toolId: string
  intent: WorkspaceIntelligenceIntent
  reason: string
  parameters?: Record<string, unknown>
}

export type AIRuntimeWarning = {
  code: string
  message: string
  severity: 'info' | 'warning' | 'blocking'
}

export type AIRuntimeValidationResult = {
  valid: boolean
  errors: AIRuntimeWarning[]
  warnings: AIRuntimeWarning[]
  rejectedActionProposals: ActionProposal[]
}

export type AIRuntimeProviderUsage = {
  knowledgeProviderIds: WorkspaceKnowledgeProviderId[]
  llmProviderId?: string
}

export type AIRuntimeToolUsage = {
  eligibleToolIds: string[]
  requestedToolIds: string[]
  executedToolIds: []
}

export type AIRuntimeResponse = {
  requestId: string
  intent: WorkspaceIntelligenceIntent
  confidence: AIRuntimeConfidence
  providerUsage: AIRuntimeProviderUsage
  toolUsage: AIRuntimeToolUsage
  knowledgeReferences: WorkspaceKnowledgeReference[]
  structuredResponse: StructuredAIOutput
  recommendedActions: ActionProposal[]
  warnings: AIRuntimeWarning[]
  citations: WorkspaceKnowledgeReference[]
  followUpSuggestions: string[]
  executionRequests: []
  prompt: StructuredPrompt
  aiRequest: StructuredAIRequest
  reasoningSnapshot: WorkspaceReasoningSnapshot
  validation: AIRuntimeValidationResult
  providerOutcome: AIRuntimeProviderOutcome
  conversation?: ConversationResponse
  events: AIRuntimeEvent[]
}

export type AIRuntimeEventType =
  | 'IntentResolved'
  | 'ContextAssembled'
  | 'ToolsSelected'
  | 'ReasoningPrepared'
  | 'AIProviderInvoked'
  | 'ResponseValidated'
  | 'ActionProposed'
  | 'ActionRejected'
  | 'ResponseCompleted'

export type AIRuntimeEvent = {
  id: string
  type: AIRuntimeEventType
  requestId: string
  createdAt: string
  metadata: Record<string, unknown>
}

export type OutputHandlerMetadata = {
  id: string
  label: string
  outputType: AIRuntimeOutputType
  validates: true
}

export type AIRuntimeRegistry = {
  knowledgeProviders: KnowledgeProviderRegistry
  toolMetadata: WorkspaceToolMetadata[]
  aiProviders: AIProviderRegistry
  outputHandlers: OutputHandlerMetadata[]
  getAIProvider: (providerId?: string) => AIProvider | null
  getToolsForIntent: (
    intent: WorkspaceIntelligenceIntent,
  ) => WorkspaceToolMetadata[]
}

export const defaultOutputHandlers: OutputHandlerMetadata[] = [
  {
    id: 'output.answer',
    label: 'Answer output',
    outputType: 'answer',
    validates: true,
  },
  {
    id: 'output.recommendations',
    label: 'Recommendation output',
    outputType: 'recommendations',
    validates: true,
  },
  {
    id: 'output.action-proposals',
    label: 'Action proposal output',
    outputType: 'actionProposals',
    validates: true,
  },
  {
    id: 'output.explanation',
    label: 'Explanation output',
    outputType: 'explanation',
    validates: true,
  },
  {
    id: 'output.summary',
    label: 'Summary output',
    outputType: 'summary',
    validates: true,
  },
  {
    id: 'output.analysis',
    label: 'Analysis output',
    outputType: 'analysis',
    validates: true,
  },
]

export function createAIRuntimeRegistry({
  knowledgeProviders = workspaceKnowledgeProviderRegistry,
  toolMetadata = workspaceIntelligenceToolRegistry,
  aiProviders = createAIProviderRegistry(),
  outputHandlers = defaultOutputHandlers,
}: {
  knowledgeProviders?: KnowledgeProviderRegistry
  toolMetadata?: WorkspaceToolMetadata[]
  aiProviders?: AIProviderRegistry
  outputHandlers?: OutputHandlerMetadata[]
} = {}): AIRuntimeRegistry {
  return {
    knowledgeProviders,
    toolMetadata,
    aiProviders,
    outputHandlers,
    getAIProvider(providerId) {
      return aiProviders.get(providerId)
    },
    getToolsForIntent(intent) {
      return toolMetadata.filter((tool) =>
        tool.supportedIntents.includes(intent),
      )
    },
  }
}

export const workspaceAIRuntimeRegistry = createAIRuntimeRegistry()

export class WorkspaceAIRuntime {
  constructor(
    private readonly registry: AIRuntimeRegistry = workspaceAIRuntimeRegistry,
  ) {}

  async run(request: AIRuntimeRequest): Promise<AIRuntimeResponse> {
    const createdAt = timestamp(request)
    const events: AIRuntimeEvent[] = []
    const intent =
      request.requestedIntent ??
      resolveIntent({
        domain: request.intentHint?.domain,
        action: request.intentHint?.action,
      })
    events.push(
      runtimeEvent({
        type: 'IntentResolved',
        request,
        createdAt,
        metadata: { intent },
      }),
    )

    const requestedProviderIds = request.requestedProviderIds
      ? new Set(request.requestedProviderIds)
      : null
    const requestedKnowledgeProviders = requestedProviderIds
      ? this.registry.knowledgeProviders
          .list()
          .filter((provider) => requestedProviderIds.has(provider.id))
      : this.registry.knowledgeProviders.list()
    const missingRequestedProviderIds =
      request.requestedProviderIds?.filter(
        (providerId) =>
          !this.registry.knowledgeProviders
            .list()
            .some((provider) => provider.id === providerId),
      ) ?? []
    const selectedKnowledgeProviders = createKnowledgeProviderRegistry(
      requestedKnowledgeProviders,
    )
    const assembled = assembleContext({
      workspace: request.workspace,
      actor: request.actor,
      requestedIntent: intent,
      providers: selectedKnowledgeProviders,
      providerSources: request.providerSources,
      language: request.actor.language,
    })
    events.push(
      runtimeEvent({
        type: 'ContextAssembled',
        request,
        createdAt,
        metadata: {
          providerIds: assembled.providerContexts.map(
            (provider) => provider.providerId,
          ),
          referenceCount: assembled.references.length,
        },
      }),
    )

    const selectedTools = selectAIRuntimeTools({
      request,
      intent,
      assembled,
      toolMetadata: this.registry.getToolsForIntent(intent),
    })
    events.push(
      runtimeEvent({
        type: 'ToolsSelected',
        request,
        createdAt,
        metadata: { toolIds: selectedTools.map((tool) => tool.id) },
      }),
    )

    const reasoningSnapshot = buildWorkspaceReasoningSnapshot({
      requestId: request.id,
      intent,
      outputType: request.requestedOutputType,
      assembled,
      selectedTools,
      selectedProviderMetadata: assembled.context.availableProviders,
      missingRequestedProviderIds,
      allowedActionTypes: request.allowedActionTypes,
      governedKnowledge: request.governedKnowledge,
      constraints: request.constraints,
      now: request.now,
    })
    events.push(
      runtimeEvent({
        type: 'ReasoningPrepared',
        request,
        createdAt,
        metadata: {
          reasoningSnapshotId: reasoningSnapshot.id,
          evidenceCount: reasoningSnapshot.evidence.length,
          contradictionCount: reasoningSnapshot.contradictions.length,
          missingInformationCount: reasoningSnapshot.missingInformation.length,
          overallConfidence: reasoningSnapshot.confidenceReport.overall,
        },
      }),
    )

    const prompt = buildStructuredPrompt({
      request,
      intent,
      assembled,
      selectedTools,
      reasoningSnapshot,
    })
    const aiRequest = buildStructuredAIRequest({
      request,
      intent,
      prompt,
      selectedTools,
      providers: assembled.context.availableProviders,
    })

    const aiProvider =
      request.executionMode === 'modelDraft'
        ? this.registry.getAIProvider(request.llmProviderId)
        : null
    const providerWarnings: AIRuntimeWarning[] =
      missingRequestedProviderIds.map((providerId) => ({
        code: 'knowledge-provider-unavailable',
        message: `Knowledge provider ${providerId} is not registered.`,
        severity: 'warning' as const,
      }))
    if (request.executionMode === 'modelDraft' && !aiProvider) {
      providerWarnings.push({
        code: 'ai-provider-unavailable',
        message: 'No AI provider is registered for this runtime request.',
        severity: 'warning',
      })
    }

    let providerOutput: StructuredAIOutput | null = null
    let providerErrorCode: string | null =
      request.executionMode === 'modelDraft' && !aiProvider
        ? 'ai-provider-unavailable'
        : null
    let providerAttempted = false
    if (aiProvider) {
      providerAttempted = true
      events.push(
        runtimeEvent({
          type: 'AIProviderInvoked',
          request,
          createdAt,
          metadata: {
            providerId: aiProvider.id,
            structuredOutput: aiProvider.supportsStructuredOutput(),
            attempted: true,
          },
        }),
      )
      try {
        providerOutput = (await aiProvider.generate(aiRequest)).output
      } catch (error) {
        if (!isAIProviderException(error)) {
          throw error
        }
        providerWarnings.push({
          code: error.providerError.code,
          message: error.providerError.message,
          severity: error.providerError.retryable ? 'warning' : 'blocking',
        })
        providerErrorCode = error.providerError.code
      }
    }

    const preliminaryProviderOutcome = resolveProviderOutcome({
      executionMode: request.executionMode,
      providerAttempted,
      aiProviderId: aiProvider?.id,
      providerOutput,
      providerErrorCode,
    })
    const rawStructuredResponse =
      providerOutput ??
      createPreparedStructuredOutput({
        intent,
        outputType: request.requestedOutputType,
        references: assembled.references,
        warnings: providerWarnings,
        providerOutcome: preliminaryProviderOutcome,
        providerLabel: aiProvider?.displayName ?? aiProvider?.label,
        knowledgeProviderLabels: assembled.context.availableProviders.map(
          (provider) => provider.label,
        ),
      })
    const toolRequestNormalization = normalizeToolRequests({
      toolRequests: rawStructuredResponse.toolRequests,
      selectedTools,
      intent,
    })
    const citationNormalization = normalizeValidatedCitationIds({
      citations: rawStructuredResponse.citations,
      allowedReferences: assembled.references,
    })
    const structuredResponse: StructuredAIOutput = {
      ...rawStructuredResponse,
      intent,
      type: request.requestedOutputType,
      toolRequests: toolRequestNormalization.toolRequests,
      citations: citationNormalization.citations,
      warnings: [
        ...(rawStructuredResponse.warnings ?? []),
        ...(toolRequestNormalization.invalidCount > 0
          ? [
              {
                code: 'invalid-tool-request-omitted',
                message: 'One invalid tool request was omitted.',
                severity: 'warning' as const,
              },
            ]
          : []),
        ...(citationNormalization.invalidCitationCount > 0
          ? [
              {
                code: 'invalid-citation',
                message: 'One supporting reference could not be validated.',
                severity: 'warning' as const,
              },
            ]
          : []),
      ],
      actionProposals: normalizeActionProposalReferences({
        proposals: rawStructuredResponse.actionProposals,
        allowedReferences: assembled.references,
      }),
    }

    const validation = validateStructuredAIOutput({
      request,
      intent,
      output: structuredResponse,
      selectedTools,
      providerReferences: assembled.references,
      invalidCitationIds: citationNormalization.invalidCitationIds,
      invalidToolRequestCount: toolRequestNormalization.invalidCount,
    })
    const providerOutcome = validation.valid
      ? preliminaryProviderOutcome
      : providerOutput
        ? 'validationFallback'
        : preliminaryProviderOutcome
    events.push(
      runtimeEvent({
        type: 'ResponseValidated',
        request,
        createdAt,
        metadata: {
          valid: validation.valid,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
        },
      }),
    )

    for (const proposal of structuredResponse.actionProposals ?? []) {
      events.push(
        runtimeEvent({
          type: validation.rejectedActionProposals.some(
            (item) => item.id === proposal.id,
          )
            ? 'ActionRejected'
            : 'ActionProposed',
          request,
          createdAt,
          metadata: {
            actionProposalId: proposal.id,
            actionType: proposal.actionType,
          },
        }),
      )
    }

    const warnings = [
      ...providerWarnings,
      ...assembled.warnings.map(
        (message): AIRuntimeWarning => ({
          code: 'context-assembly-warning',
          message,
          severity: 'warning',
        }),
      ),
      ...validation.warnings,
      ...validation.errors,
    ]
    const recommendedActions = (
      structuredResponse.actionProposals ?? []
    ).filter(
      (proposal) =>
        !validation.rejectedActionProposals.some(
          (item) => item.id === proposal.id,
        ),
    )
    const response: AIRuntimeResponse = {
      requestId: request.id,
      intent,
      confidence: validation.valid ? structuredResponse.confidence : 'low',
      providerUsage: {
        knowledgeProviderIds: assembled.providerContexts.map(
          (provider) => provider.providerId,
        ),
        llmProviderId: aiProvider?.id,
      },
      toolUsage: {
        eligibleToolIds: selectedTools.map((tool) => tool.id),
        requestedToolIds:
          structuredResponse.toolRequests?.map((tool) => tool.toolId) ?? [],
        executedToolIds: [],
      },
      knowledgeReferences: assembled.references,
      structuredResponse,
      recommendedActions,
      warnings,
      citations: structuredResponse.citations ?? [],
      followUpSuggestions: structuredResponse.followUpSuggestions ?? [],
      executionRequests: [],
      prompt,
      aiRequest,
      reasoningSnapshot,
      validation,
      providerOutcome,
      conversation: request.conversation?.metadata
        ? { metadata: request.conversation.metadata }
        : undefined,
      events: [
        ...events,
        runtimeEvent({
          type: 'ResponseCompleted',
          request,
          createdAt,
          metadata: { valid: validation.valid, providerOutcome },
        }),
      ],
    }
    return response
  }
}

export function selectAIRuntimeTools({
  request,
  intent,
  assembled,
  toolMetadata,
}: {
  request: AIRuntimeRequest
  intent: WorkspaceIntelligenceIntent
  assembled: WorkspaceContextAssemblerResult
  toolMetadata: WorkspaceToolMetadata[]
}): WorkspaceToolMetadata[] {
  const availableCapabilityKeys = new Set(
    assembled.context.capabilities
      .filter((capability) => capability.supported)
      .map((capability) => capability.key),
  )
  const actorPermissions = new Set(request.actor.permissions)
  const activeProviderIds = new Set(
    assembled.providerContexts.map((provider) => provider.providerId),
  )
  const allowedToolIds = request.allowedToolIds
    ? new Set(request.allowedToolIds)
    : null
  return toolMetadata
    .filter((tool) => tool.supportedIntents.includes(intent))
    .filter((tool) => !allowedToolIds || allowedToolIds.has(tool.id))
    .filter((tool) =>
      tool.requiredCapabilities.every((capability) =>
        availableCapabilityKeys.has(capability),
      ),
    )
    .filter((tool) =>
      tool.requiredPermissions.every((permission) =>
        actorPermissions.has(permission),
      ),
    )
    .filter((tool) =>
      tool.supportedProviderIds.every((providerId) =>
        activeProviderIds.has(providerId),
      ),
    )
    .sort((first, second) => first.id.localeCompare(second.id))
}

export function buildStructuredPrompt({
  request,
  intent,
  assembled,
  selectedTools,
  reasoningSnapshot,
}: {
  request: AIRuntimeRequest
  intent: WorkspaceIntelligenceIntent
  assembled: WorkspaceContextAssemblerResult
  selectedTools: WorkspaceToolMetadata[]
  reasoningSnapshot?: WorkspaceReasoningSnapshot
}): StructuredPrompt {
  const preparedReasoningSnapshot =
    reasoningSnapshot ??
    buildWorkspaceReasoningSnapshot({
      requestId: request.id,
      intent,
      outputType: request.requestedOutputType,
      assembled,
      selectedTools,
      selectedProviderMetadata: assembled.context.availableProviders,
      allowedActionTypes: request.allowedActionTypes,
      governedKnowledge: request.governedKnowledge,
      constraints: request.constraints,
      now: request.now,
    })
  return {
    intent,
    systemContext: {
      runtime: 'WorkspaceAIRuntime',
      version: 'foundation',
      executionBoundary: 'propose-only',
    },
    workspaceContext: assembled.context,
    workspaceState: assembled.state,
    reasoningSnapshot: preparedReasoningSnapshot,
    knowledgeReferences: assembled.references,
    toolMetadata: selectedTools,
    governedKnowledge: request.governedKnowledge,
    requestedOutput: {
      type: request.requestedOutputType,
      capabilities: request.requestedCapabilities ?? [],
    },
    constraints: [
      'Return structured output only.',
      'Do not execute business logic.',
      'Only request eligible tools.',
      'Only cite provided knowledge reference IDs.',
      'Omit citations when no provided reference applies.',
      'Never invent citation IDs or output null, undefined, or placeholder citations.',
      'Use the Workspace Reasoning Engine snapshot as the source of reasoning, confidence, contradictions, missing data, recommendations, and proposal previews.',
      'Clearly distinguish Verified, Likely, Unknown, Recommendation, and Proposal.',
      ...(request.constraints ?? []),
    ],
  }
}

export function buildStructuredAIRequest({
  request,
  intent,
  prompt,
  selectedTools,
  providers,
}: {
  request: AIRuntimeRequest
  intent: WorkspaceIntelligenceIntent
  prompt: StructuredPrompt
  selectedTools: WorkspaceToolMetadata[]
  providers: KnowledgeProviderMetadata[]
}): StructuredAIRequest {
  return {
    id: `ai-request:${request.id}`,
    intent,
    prompt,
    outputSchema: getStructuredOutputSchema(request.requestedOutputType),
    allowedTools: selectedTools,
    knowledgeProviderMetadata: providers,
  }
}

export function getStructuredOutputSchema(
  outputType: AIRuntimeOutputType,
): StructuredOutputSchema {
  return {
    type: outputType,
    requiredFields: ['intent', 'type', 'confidence'],
    supportsActionProposals:
      outputType === 'actionProposals' ||
      outputType === 'recommendations' ||
      outputType === 'analysis',
    supportsToolRequests: true,
  }
}

export function validateStructuredAIOutput({
  request,
  intent,
  output,
  selectedTools,
  providerReferences,
  invalidCitationIds = [],
  invalidToolRequestCount = 0,
}: {
  request: AIRuntimeRequest
  intent: WorkspaceIntelligenceIntent
  output: StructuredAIOutput
  selectedTools: WorkspaceToolMetadata[]
  providerReferences: WorkspaceKnowledgeReference[]
  invalidCitationIds?: string[]
  invalidToolRequestCount?: number
}): AIRuntimeValidationResult {
  const errors: AIRuntimeWarning[] = []
  const warnings: AIRuntimeWarning[] = []
  const rejectedActionProposals: ActionProposal[] = []
  const selectedToolIds = new Set(selectedTools.map((tool) => tool.id))
  const providerReferenceIds = new Set(
    providerReferences.map((reference) => reference.id),
  )
  const allowedActionTypes = new Set(request.allowedActionTypes ?? [])

  if (invalidToolRequestCount > 0) {
    warnings.push({
      code: 'invalid-tool-request-omitted',
      message: 'One invalid tool request was omitted.',
      severity: 'warning',
    })
  }

  if (output.intent !== intent) {
    errors.push({
      code: 'intent-mismatch',
      message: `AI output intent ${output.intent} did not match requested intent ${intent}.`,
      severity: 'blocking',
    })
  }
  if (output.type !== request.requestedOutputType) {
    errors.push({
      code: 'output-type-mismatch',
      message: `AI output type ${output.type} did not match requested output ${request.requestedOutputType}.`,
      severity: 'blocking',
    })
  }
  for (const toolRequest of output.toolRequests ?? []) {
    if (!selectedToolIds.has(toolRequest.toolId)) {
      errors.push({
        code: 'invalid-tool-request',
        message: `Tool request ${toolRequest.toolId} is not eligible for this runtime request.`,
        severity: 'blocking',
      })
    }
  }
  for (const invalidCitationId of invalidCitationIds) {
    errors.push({
      code: 'invalid-citation',
      message:
        invalidCitationId === 'invalid-citation-id'
          ? 'A citation without a valid ID was not provided by Workspace Intelligence.'
          : `Citation ${invalidCitationId} was not provided by Workspace Intelligence.`,
      severity: 'blocking',
    })
  }
  for (const citation of output.citations ?? []) {
    if (!providerReferenceIds.has(citation.id)) {
      errors.push({
        code: 'invalid-citation',
        message: 'One supporting reference could not be validated.',
        severity: 'blocking',
      })
    }
  }
  for (const proposal of output.actionProposals ?? []) {
    if (
      allowedActionTypes.size === 0 ||
      !allowedActionTypes.has(proposal.actionType)
    ) {
      rejectedActionProposals.push(proposal)
      errors.push({
        code: 'unknown-action-proposal',
        message: `Action proposal ${proposal.actionType} is not allowed for this request.`,
        severity: 'blocking',
      })
    }
    if (
      proposal.requiredToolId &&
      !selectedToolIds.has(proposal.requiredToolId)
    ) {
      rejectedActionProposals.push(proposal)
      errors.push({
        code: 'action-tool-not-eligible',
        message: `Action proposal ${proposal.id} requires ineligible tool ${proposal.requiredToolId}.`,
        severity: 'blocking',
      })
    }
  }
  if ((output.executionRequests ?? []).length > 0) {
    errors.push({
      code: 'execution-request-rejected',
      message: 'The AI runtime does not execute business actions.',
      severity: 'blocking',
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rejectedActionProposals: dedupeActionProposals(rejectedActionProposals),
  }
}

function createPreparedStructuredOutput({
  intent,
  outputType,
  references,
  warnings,
  providerOutcome,
  providerLabel,
  knowledgeProviderLabels,
}: {
  intent: WorkspaceIntelligenceIntent
  outputType: AIRuntimeOutputType
  references: WorkspaceKnowledgeReference[]
  warnings: AIRuntimeWarning[]
  providerOutcome: AIRuntimeProviderOutcome
  providerLabel?: string
  knowledgeProviderLabels: string[]
}): StructuredAIOutput {
  const knowledgeProviderLabel =
    knowledgeProviderLabels[0] ?? 'Workspace Knowledge'
  return {
    intent,
    type: outputType,
    confidence: references.length > 0 ? 'medium' : 'low',
    answer: {
      summary: preparedOutputSummary({
        providerOutcome,
        providerLabel,
        knowledgeProviderLabel,
      }),
    },
    warnings,
    citations: references,
    followUpSuggestions: [],
  }
}

function resolveProviderOutcome({
  executionMode,
  providerAttempted,
  aiProviderId,
  providerOutput,
  providerErrorCode,
}: {
  executionMode: AIRuntimeExecutionMode
  providerAttempted: boolean
  aiProviderId?: string
  providerOutput: StructuredAIOutput | null
  providerErrorCode: string | null
}): AIRuntimeProviderOutcome {
  if (providerOutput) return 'generated'
  if (
    providerErrorCode === 'openai-timeout' ||
    providerErrorCode === 'OPENAI_TIMEOUT'
  )
    return 'providerTimeout'
  if (
    providerErrorCode === 'openai-disabled' ||
    providerErrorCode === 'OPENAI_API_KEY_MISSING' ||
    providerErrorCode === 'OPENAI_PROVIDER_DISABLED' ||
    providerErrorCode === 'openai-unavailable' ||
    providerErrorCode === 'OPENAI_PROVIDER_UNAVAILABLE' ||
    providerErrorCode === 'ai-provider-unavailable'
  ) {
    return 'providerUnavailable'
  }
  if (providerAttempted && providerErrorCode) return 'failed'
  if (executionMode === 'modelDraft' && aiProviderId) return 'failed'
  return 'deterministicFallback'
}

function preparedOutputSummary({
  providerOutcome,
  providerLabel,
  knowledgeProviderLabel,
}: {
  providerOutcome: AIRuntimeProviderOutcome
  providerLabel?: string
  knowledgeProviderLabel: string
}) {
  const provider = providerLabel ?? 'The AI provider'
  if (providerOutcome === 'providerTimeout') {
    return `${provider} timed out, so Skillify is showing a deterministic summary from ${knowledgeProviderLabel}.`
  }
  if (providerOutcome === 'providerUnavailable') {
    return `${provider} is unavailable, so Skillify is showing a deterministic summary from ${knowledgeProviderLabel}.`
  }
  if (providerOutcome === 'failed') {
    return `${provider} could not generate a response, so Skillify is showing a deterministic summary from ${knowledgeProviderLabel}.`
  }
  return `Skillify prepared a deterministic summary from ${knowledgeProviderLabel}.`
}

function runtimeEvent({
  type,
  request,
  createdAt,
  metadata,
}: {
  type: AIRuntimeEventType
  request: AIRuntimeRequest
  createdAt: string
  metadata: Record<string, unknown>
}): AIRuntimeEvent {
  return {
    id: `runtime-event:${request.id}:${type}`,
    type,
    requestId: request.id,
    createdAt,
    metadata,
  }
}

function timestamp(request: AIRuntimeRequest) {
  return (request.now ?? new Date()).toISOString()
}

function dedupeActionProposals(proposals: ActionProposal[]) {
  return [
    ...new Map(proposals.map((proposal) => [proposal.id, proposal])).values(),
  ]
}

function normalizeActionProposalReferences({
  proposals,
  allowedReferences,
}: {
  proposals?: ActionProposal[]
  allowedReferences: WorkspaceKnowledgeReference[]
}) {
  const normalized = (Array.isArray(proposals) ? proposals : [])
    .filter(isValidActionProposalShape)
    .map((proposal) => ({
      ...proposal,
      references: normalizeValidatedCitationIds({
        citations: proposal.references,
        allowedReferences,
      }).citations,
    }))
  return normalized.length ? normalized : undefined
}

function isValidActionProposalShape(value: unknown): value is ActionProposal {
  if (!value || typeof value !== 'object') return false
  const proposal = value as Partial<ActionProposal>
  return (
    typeof proposal.id === 'string' &&
    proposal.id.trim().length > 0 &&
    typeof proposal.actionType === 'string' &&
    proposal.actionType.trim().length > 0
  )
}

function normalizeToolRequests({
  toolRequests,
  selectedTools,
  intent,
}: {
  toolRequests?: ToolRequest[]
  selectedTools: WorkspaceToolMetadata[]
  intent: WorkspaceIntelligenceIntent
}) {
  const selectedToolIds = new Set(selectedTools.map((tool) => tool.id))
  const normalized: ToolRequest[] = []
  let invalidCount = 0
  const seen = new Set<string>()

  for (const item of Array.isArray(toolRequests) ? toolRequests : []) {
    const record = item as Partial<ToolRequest>
    const toolId = typeof record.toolId === 'string' ? record.toolId.trim() : ''
    if (
      !toolId ||
      toolId.toLowerCase() === 'undefined' ||
      toolId.toLowerCase() === 'null' ||
      !selectedToolIds.has(toolId)
    ) {
      invalidCount += 1
      continue
    }
    if (seen.has(toolId)) continue
    seen.add(toolId)
    normalized.push({
      id:
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `tool-request:${toolId}`,
      toolId,
      intent,
      reason:
        typeof record.reason === 'string' && record.reason.trim()
          ? record.reason.trim()
          : 'Requested by provider and validated against eligible tools.',
      parameters:
        record.parameters && typeof record.parameters === 'object'
          ? record.parameters
          : undefined,
    })
  }

  return {
    toolRequests: normalized,
    invalidCount,
  }
}

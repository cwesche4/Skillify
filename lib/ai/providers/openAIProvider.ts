import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from 'openai'

import {
  AIProviderException,
  createAIEmbeddingProviderRegistry,
  createAIProviderRegistry,
  defaultAIProviderCapabilities,
  type AIEmbeddingProvider,
  type AIEmbeddingRequest,
  type AIEmbeddingResponse,
  type AIProvider,
  type AIProviderAvailability,
  type AIProviderError,
  type AIProviderGenerateResponse,
  type AIProviderModel,
} from '@/lib/ai/providers/aiProviderLayer'
import type {
  ActionProposal,
  AIRuntimeConfidence,
  AIRuntimeWarning,
  StructuredAIOutput,
  StructuredAIRequest,
  ToolRequest,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import { normalizeValidatedCitationIds } from '@/lib/ai/runtime/citations'
import type {
  WorkspaceKnowledgeReference,
  WorkspaceRecommendation,
} from '@/lib/intelligence/workspaceIntelligence'

export const OPENAI_GENERATION_PROVIDER_ID = 'openai-generation'
export const OPENAI_EMBEDDING_PROVIDER_ID = 'openai-embeddings'

export type OpenAIProviderConfig = {
  apiKey?: string
  enabled: boolean
  organization?: string
  project?: string
  defaultModel: string
  reasoningModel: string
  embeddingModel: string
  timeoutMs: number
  maxRetries: number
}

export type OpenAIGenerationClient = {
  responses: {
    create: (body: Record<string, unknown>) => Promise<OpenAIResponseLike>
  }
}

export type OpenAIEmbeddingClient = {
  embeddings: {
    create: (
      body: Record<string, unknown>,
    ) => Promise<OpenAIEmbeddingResponseLike>
  }
}

export type OpenAIResponseLike = {
  id?: string
  model?: string
  output_text?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
}

export type OpenAIEmbeddingResponseLike = {
  model?: string
  data: Array<{
    embedding: number[]
    index?: number
  }>
  usage?: {
    prompt_tokens?: number
    total_tokens?: number
  }
}

export type CreateOpenAIGenerationProviderOptions = {
  config?: Partial<OpenAIProviderConfig>
  client?: OpenAIGenerationClient
  now?: () => number
}

export type CreateOpenAIEmbeddingProviderOptions = {
  config?: Partial<OpenAIProviderConfig>
  client?: OpenAIEmbeddingClient
  now?: () => number
}

export const openAIGenerationModels: AIProviderModel[] = [
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      reasoning: false,
      jsonMode: true,
      streaming: true,
      longContext: true,
    },
    defaultOutputType: 'answer',
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      reasoning: false,
      vision: true,
      jsonMode: true,
      streaming: true,
      longContext: true,
    },
    defaultOutputType: 'answer',
  },
  {
    id: 'o4-mini',
    label: 'OpenAI o4-mini',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      reasoning: true,
      vision: true,
      jsonMode: true,
      streaming: true,
      longContext: true,
    },
    defaultOutputType: 'analysis',
  },
]

export const openAIEmbeddingModels: AIProviderModel[] = [
  {
    id: 'text-embedding-3-small',
    label: 'Text embedding 3 small',
    capabilities: {
      embeddings: true,
    },
  },
  {
    id: 'text-embedding-3-large',
    label: 'Text embedding 3 large',
    capabilities: {
      embeddings: true,
    },
  },
]

export function resolveOpenAIProviderConfig(
  overrides: Partial<OpenAIProviderConfig> = {},
): OpenAIProviderConfig {
  return {
    apiKey: overrides.apiKey ?? process.env.OPENAI_API_KEY,
    enabled: overrides.enabled ?? true,
    organization: overrides.organization ?? process.env.OPENAI_ORG_ID,
    project: overrides.project ?? process.env.OPENAI_PROJECT_ID,
    defaultModel:
      overrides.defaultModel ??
      process.env.OPENAI_DEFAULT_MODEL ??
      'gpt-4.1-mini',
    reasoningModel:
      overrides.reasoningModel ??
      process.env.OPENAI_REASONING_MODEL ??
      'o4-mini',
    embeddingModel:
      overrides.embeddingModel ??
      process.env.OPENAI_EMBEDDING_MODEL ??
      'text-embedding-3-small',
    timeoutMs: normalizePositiveInteger(
      overrides.timeoutMs,
      process.env.OPENAI_TIMEOUT_MS,
      30_000,
    ),
    maxRetries: normalizeRetryCount(
      overrides.maxRetries,
      process.env.OPENAI_MAX_RETRIES,
      1,
    ),
  }
}

export function createOpenAIGenerationProvider({
  config: configOverrides,
  client,
  now = Date.now,
}: CreateOpenAIGenerationProviderOptions = {}): AIProvider {
  const config = resolveOpenAIProviderConfig(configOverrides)
  const availability = getOpenAIAvailability(config)
  let resolvedClient = client

  const provider: AIProvider = {
    id: OPENAI_GENERATION_PROVIDER_ID,
    label: 'OpenAI',
    displayName: 'OpenAI',
    version: 'responses-api',
    supportedModels: openAIGenerationModels,
    capabilities: {
      ...defaultAIProviderCapabilities,
      structuredOutput: true,
      toolCalling: true,
      reasoning: true,
      vision: true,
      images: false,
      streaming: true,
      embeddings: false,
      audio: false,
      longContext: true,
      jsonMode: true,
      mcp: false,
    },
    health: availability,
    availability,
    async generate(request) {
      assertOpenAIConfigured({
        config,
        providerId: OPENAI_GENERATION_PROVIDER_ID,
        requestId: request.id,
      })
      const startedAt = now()
      const model = selectOpenAIModel(request, config)
      logOpenAIProviderTrace({
        stage: 'PROVIDER_CONFIGURATION',
        request,
        model,
        startedAtMs: startedAt,
        sdkRequestAttempted: false,
      })
      assertOpenAIModelSupported({
        config,
        model,
        providerId: OPENAI_GENERATION_PROVIDER_ID,
        requestId: request.id,
      })
      const openAIRequest = buildOpenAIResponseRequestSafely({
        request,
        config,
        model,
      })
      logOpenAIProviderTrace({
        stage: 'REQUEST_SCHEMA_BUILT',
        request,
        model,
        startedAtMs: startedAt,
        sdkRequestAttempted: false,
        requestBody: openAIRequest,
      })
      logOpenAIProviderTrace({
        stage: 'REQUEST_BODY_READY',
        request,
        model,
        startedAtMs: startedAt,
        sdkRequestAttempted: false,
        requestBody: openAIRequest,
      })
      const response = await callWithRetry({
        providerId: OPENAI_GENERATION_PROVIDER_ID,
        maxRetries: config.maxRetries,
        operation: async () => {
          try {
            logOpenAIProviderTrace({
              stage: 'OPENAI_REQUEST_STARTED',
              request,
              model,
              startedAtMs: startedAt,
              sdkRequestAttempted: true,
              requestBody: openAIRequest,
            })
            return await getGenerationClient({
              config,
              client: resolvedClient,
              setClient: (nextClient) => {
                resolvedClient = nextClient
              },
            }).responses.create(openAIRequest)
          } catch (error) {
            logOpenAIProviderTrace({
              stage: 'OPENAI_REQUEST_FAILED',
              request,
              model,
              startedAtMs: startedAt,
              sdkRequestAttempted: true,
              requestBody: openAIRequest,
              error,
            })
            logOpenAIBadRequestDiagnostics({
              error,
              requestBody: openAIRequest,
            })
            throw error
          }
        },
      })
      logOpenAIProviderTrace({
        stage: 'OPENAI_REQUEST_COMPLETED',
        request,
        model,
        startedAtMs: startedAt,
        sdkRequestAttempted: true,
        requestBody: openAIRequest,
      })
      logOpenAIProviderTrace({
        stage: 'OPENAI_RESPONSE_RECEIVED',
        request,
        model: response.model ?? model,
        startedAtMs: startedAt,
        sdkRequestAttempted: true,
        requestBody: openAIRequest,
      })
      const latencyMs = Math.max(0, now() - startedAt)
      logOpenAIProviderTrace({
        stage: 'NORMALIZATION_STARTED',
        request,
        model: response.model ?? model,
        startedAtMs: startedAt,
        sdkRequestAttempted: true,
        requestBody: openAIRequest,
      })
      const normalized = toOpenAIGenerationResponse({
        request,
        response,
        fallbackModel: model,
        latencyMs,
      })
      logOpenAIProviderTrace({
        stage: 'NORMALIZATION_COMPLETED',
        request,
        model: normalized.modelId ?? response.model ?? model,
        startedAtMs: startedAt,
        sdkRequestAttempted: true,
        requestBody: openAIRequest,
        context: {
          providerId: normalized.providerId,
          rawResponseReference: normalized.rawResponseReference,
        },
      })
      return normalized
    },
    supportsStructuredOutput: () => provider.capabilities.structuredOutput,
    supportsTools: () => provider.capabilities.toolCalling,
    supportsImages: () => provider.capabilities.images,
    supportsReasoning: () => provider.capabilities.reasoning,
    supportsVision: () => provider.capabilities.vision,
    supportsStreaming: () => provider.capabilities.streaming,
  }

  return provider
}

export function createOpenAIEmbeddingProvider({
  config: configOverrides,
  client,
  now = Date.now,
}: CreateOpenAIEmbeddingProviderOptions = {}): AIEmbeddingProvider {
  const config = resolveOpenAIProviderConfig(configOverrides)
  const availability = getOpenAIAvailability(config)
  let resolvedClient = client

  return {
    id: OPENAI_EMBEDDING_PROVIDER_ID,
    label: 'OpenAI Embeddings',
    displayName: 'OpenAI Embeddings',
    version: 'embeddings-api',
    supportedEmbeddingModels: openAIEmbeddingModels,
    health: availability,
    availability,
    async embed(request) {
      assertOpenAIConfigured({
        config,
        providerId: OPENAI_EMBEDDING_PROVIDER_ID,
        requestId: request.id,
      })
      const startedAt = now()
      const modelId = request.modelId ?? config.embeddingModel
      const response = await callWithRetry({
        providerId: OPENAI_EMBEDDING_PROVIDER_ID,
        maxRetries: config.maxRetries,
        operation: () =>
          getEmbeddingClient({
            config,
            client: resolvedClient,
            setClient: (nextClient) => {
              resolvedClient = nextClient
            },
          }).embeddings.create({
            model: modelId,
            input: request.input,
            encoding_format: 'float',
          }),
      })
      const latencyMs = Math.max(0, now() - startedAt)
      return toOpenAIEmbeddingResponse({
        response,
        fallbackModel: modelId,
        latencyMs,
      })
    },
    supportsEmbeddings: () => true,
  }
}

export function createOpenAIProviderRegistry(
  options: CreateOpenAIGenerationProviderOptions = {},
) {
  const provider = createOpenAIGenerationProvider(options)
  return createAIProviderRegistry({
    providers: [provider],
    defaultProviderId: provider.id,
  })
}

export function createOpenAIEmbeddingProviderRegistry(
  options: CreateOpenAIEmbeddingProviderOptions = {},
) {
  const provider = createOpenAIEmbeddingProvider(options)
  return createAIEmbeddingProviderRegistry({
    providers: [provider],
    defaultProviderId: provider.id,
  })
}

export function normalizeOpenAIProviderError({
  error,
  providerId,
}: {
  error: unknown
  providerId: string
}): AIProviderError {
  if (error instanceof AIProviderException) {
    return error.providerError
  }
  if (error instanceof AuthenticationError) {
    return {
      code: 'OPENAI_AUTHENTICATION_FAILED',
      message:
        'OpenAI authentication failed. Check the server OpenAI API key and project access.',
      providerId,
      retryable: false,
      metadata: openAIErrorMetadata(error),
    }
  }
  if (error instanceof BadRequestError) {
    const metadata = openAIErrorMetadata(error)
    const code =
      metadata.param === 'model' || isModelErrorMessage(error.message)
        ? 'OPENAI_MODEL_INVALID'
        : 'OPENAI_REQUEST_BUILD_FAILED'
    return {
      code,
      message:
        code === 'OPENAI_MODEL_INVALID'
          ? 'The configured OpenAI model is invalid or unavailable to this project.'
          : 'OpenAI rejected the generated request body.',
      providerId,
      retryable: false,
      metadata,
    }
  }
  if (error instanceof RateLimitError) {
    return {
      code: 'OPENAI_RATE_LIMITED',
      message:
        'OpenAI rate limit was reached. Retry after the provider allows more requests.',
      providerId,
      retryable: true,
      metadata: openAIErrorMetadata(error),
    }
  }
  if (
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIUserAbortError
  ) {
    return {
      code: 'OPENAI_TIMEOUT',
      message: 'OpenAI request timed out.',
      providerId,
      retryable: true,
    }
  }
  if (error instanceof APIConnectionError) {
    return {
      code: 'OPENAI_NETWORK_ERROR',
      message: 'OpenAI could not be reached from the server.',
      providerId,
      retryable: true,
    }
  }
  if (error instanceof APIError) {
    const status = error.status
    const unavailable = Boolean(status && status >= 500)
    return {
      code: unavailable
        ? 'OPENAI_PROVIDER_UNAVAILABLE'
        : 'OPENAI_UNKNOWN_FAILURE',
      message: unavailable
        ? 'OpenAI is temporarily unavailable.'
        : 'OpenAI provider request failed.',
      providerId,
      retryable: Boolean(
        status &&
        (status === 408 || status === 409 || status === 429 || status >= 500),
      ),
      metadata: openAIErrorMetadata(error),
    }
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      code: 'OPENAI_TIMEOUT',
      message: 'OpenAI request timed out.',
      providerId,
      retryable: true,
    }
  }
  return {
    code: 'OPENAI_UNKNOWN_FAILURE',
    message: 'OpenAI provider returned an unexpected response.',
    providerId,
    retryable: false,
  }
}

function getOpenAIAvailability(
  config: OpenAIProviderConfig,
): AIProviderAvailability {
  if (!config.enabled) {
    return {
      status: 'disabled',
      reason: 'OpenAI provider is disabled by provider configuration.',
    }
  }
  if (!config.apiKey?.trim()) {
    return {
      status: 'disabled',
      reason: 'OPENAI_API_KEY is not configured.',
    }
  }
  return { status: 'healthy' }
}

function assertOpenAIConfigured({
  config,
  providerId,
  requestId,
}: {
  config: OpenAIProviderConfig
  providerId: string
  requestId: string
}) {
  if (!config.enabled) {
    const providerError: AIProviderError = {
      code: 'OPENAI_PROVIDER_DISABLED',
      message: 'OpenAI provider is disabled on the server.',
      providerId,
      retryable: false,
      metadata: openAIConfigurationMetadata({
        config,
        requestId,
        condition: 'provider configuration disabled',
      }),
    }
    logOpenAIProviderDiagnostics({ providerError, config, requestId })
    throw new AIProviderException(providerError)
  }
  if (!config.apiKey?.trim()) {
    const providerError: AIProviderError = {
      code: 'OPENAI_API_KEY_MISSING',
      message:
        'OpenAI API key was not found in the server environment. Configure OPENAI_API_KEY on the server before retrying.',
      providerId,
      retryable: false,
      metadata: openAIConfigurationMetadata({
        config,
        requestId,
        condition: 'OPENAI_API_KEY missing',
      }),
    }
    logOpenAIProviderDiagnostics({ providerError, config, requestId })
    throw new AIProviderException(providerError)
  }
}

function assertOpenAIModelSupported({
  config,
  model,
  providerId,
  requestId,
}: {
  config: OpenAIProviderConfig
  model: string
  providerId: string
  requestId: string
}) {
  if (openAIGenerationModels.some((candidate) => candidate.id === model)) return
  const providerError: AIProviderError = {
    code: 'OPENAI_MODEL_INVALID',
    message: `Configured OpenAI model "${model}" is not supported by Skillify's OpenAI provider configuration.`,
    providerId,
    retryable: false,
    metadata: openAIConfigurationMetadata({
      config,
      requestId,
      condition: 'unsupported model',
      selectedModel: model,
    }),
  }
  logOpenAIProviderDiagnostics({
    providerError,
    config,
    requestId,
    selectedModel: model,
  })
  throw new AIProviderException(providerError)
}

function getGenerationClient({
  config,
  client,
  setClient,
}: {
  config: OpenAIProviderConfig
  client?: OpenAIGenerationClient
  setClient: (client: OpenAIGenerationClient) => void
}) {
  if (client) return client
  const nextClient = createOpenAIClient(
    config,
  ) as unknown as OpenAIGenerationClient
  setClient(nextClient)
  return nextClient
}

function getEmbeddingClient({
  config,
  client,
  setClient,
}: {
  config: OpenAIProviderConfig
  client?: OpenAIEmbeddingClient
  setClient: (client: OpenAIEmbeddingClient) => void
}) {
  if (client) return client
  const nextClient = createOpenAIClient(
    config,
  ) as unknown as OpenAIEmbeddingClient
  setClient(nextClient)
  return nextClient
}

function createOpenAIClient(config: OpenAIProviderConfig) {
  try {
    return new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      project: config.project,
      timeout: config.timeoutMs,
      maxRetries: 0,
    })
  } catch (error) {
    const providerError: AIProviderError = {
      code: 'OPENAI_CLIENT_INITIALIZATION_FAILED',
      message: 'OpenAI client could not be initialized on the server.',
      providerId: OPENAI_GENERATION_PROVIDER_ID,
      retryable: false,
      metadata: {
        originalErrorClass:
          error instanceof Error ? error.constructor.name : typeof error,
        originalErrorMessage:
          error instanceof Error ? error.message : String(error),
      },
    }
    logOpenAIProviderDiagnostics({
      providerError,
      config,
      requestId: 'client-initialization',
      error,
    })
    throw new AIProviderException(providerError)
  }
}

async function callWithRetry<T>({
  operation,
  providerId,
  maxRetries,
}: {
  operation: () => Promise<T>
  providerId: string
  maxRetries: number
}): Promise<T> {
  let attempt = 0
  let lastError: AIProviderError | null = null
  while (attempt <= maxRetries) {
    try {
      return await operation()
    } catch (error) {
      const normalized = normalizeOpenAIProviderError({ error, providerId })
      lastError = normalized
      if (!normalized.retryable || attempt >= maxRetries) {
        throw new AIProviderException(normalized)
      }
      attempt += 1
    }
  }
  throw new AIProviderException(
    lastError ?? {
      code: 'OPENAI_UNKNOWN_FAILURE',
      message: 'OpenAI provider request failed.',
      providerId,
      retryable: false,
    },
  )
}

function buildOpenAIResponseRequest({
  request,
  config,
  model,
}: {
  request: StructuredAIRequest
  config: OpenAIProviderConfig
  model: string
}) {
  const body: Record<string, unknown> = {
    model,
    input: JSON.stringify({
      prompt: request.prompt,
      outputSchema: request.outputSchema,
      allowedTools: request.allowedTools,
      knowledgeProviderMetadata: request.knowledgeProviderMetadata,
    }),
    instructions: [
      'You are Skillify Workspace AI runtime provider.',
      'Return only JSON that matches the provided schema.',
      'Do not execute business actions.',
      'Do not request tools unless toolRequests are explicitly supported.',
    ].join('\n'),
    text: {
      format: {
        type: 'json_schema',
        name: 'skillify_structured_ai_output',
        strict: false,
        schema: structuredAIOutputJsonSchema,
      },
    },
    metadata: {
      runtimeRequestId: request.id,
      intent: request.intent,
      outputType: request.outputSchema.type,
    },
  }
  if (!isOpenAIReasoningModel(model)) {
    body.temperature = 0
  }
  return body
}

function buildOpenAIResponseRequestSafely({
  request,
  config,
  model,
}: {
  request: StructuredAIRequest
  config: OpenAIProviderConfig
  model: string
}) {
  try {
    return buildOpenAIResponseRequest({ request, config, model })
  } catch (error) {
    const providerError: AIProviderError = {
      code: 'OPENAI_REQUEST_BUILD_FAILED',
      message: 'Skillify could not build a valid OpenAI request.',
      providerId: OPENAI_GENERATION_PROVIDER_ID,
      retryable: false,
      metadata: {
        requestId: request.id,
        selectedModel: model,
        originalErrorClass:
          error instanceof Error ? error.constructor.name : typeof error,
        originalErrorMessage:
          error instanceof Error ? error.message : String(error),
      },
    }
    logOpenAIProviderDiagnostics({
      providerError,
      config,
      requestId: request.id,
      selectedModel: model,
      error,
    })
    throw new AIProviderException(providerError)
  }
}

function isOpenAIReasoningModel(model: string) {
  const normalized = model.toLowerCase()
  return (
    /^o\d/.test(normalized) ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4') ||
    normalized.startsWith('gpt-5')
  )
}

function logOpenAIProviderTrace({
  stage,
  request,
  model,
  startedAtMs,
  sdkRequestAttempted,
  requestBody,
  error,
  context,
}: {
  stage: string
  request: StructuredAIRequest
  model: string
  startedAtMs: number
  sdkRequestAttempted: boolean
  requestBody?: Record<string, unknown>
  error?: unknown
  context?: Record<string, unknown>
}) {
  if (process.env.NODE_ENV !== 'development') return
  const requestSummary = requestBody
    ? summarizeOpenAIResponseRequest(requestBody)
    : undefined
  console.info('[Skillify][OpenAI] Provider trace', {
    stage,
    requestId: request.id,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    providerName: 'openai',
    model,
    responseFormat: request.outputSchema.type,
    schemaIdentifier: requestSummary?.schemaIdentifier,
    sdkRequestAttempted,
    requestBody: requestSummary,
    ...context,
    exceptionClass: error instanceof Error ? error.constructor.name : undefined,
    exceptionMessage: error instanceof Error ? error.message : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  })
}

function summarizeOpenAIResponseRequest(body: Record<string, unknown>) {
  const text = isRecord(body.text) ? body.text : undefined
  const format = text && isRecord(text.format) ? text.format : undefined
  const metadata = isRecord(body.metadata) ? body.metadata : undefined
  return {
    model: typeof body.model === 'string' ? body.model : undefined,
    hasInput: typeof body.input === 'string' && body.input.length > 0,
    inputLength: typeof body.input === 'string' ? body.input.length : undefined,
    hasInstructions:
      typeof body.instructions === 'string' && body.instructions.length > 0,
    responseFormat: typeof format?.type === 'string' ? format.type : undefined,
    schemaIdentifier:
      typeof format?.name === 'string' ? format.name : undefined,
    strict: typeof format?.strict === 'boolean' ? format.strict : undefined,
    metadataKeys: metadata ? Object.keys(metadata).sort() : [],
    hasTemperature: Object.prototype.hasOwnProperty.call(body, 'temperature'),
    requestKeys: Object.keys(body).sort(),
  }
}

function logOpenAIBadRequestDiagnostics({
  error,
  requestBody,
}: {
  error: unknown
  requestBody: Record<string, unknown>
}) {
  if (
    process.env.NODE_ENV === 'production' ||
    !isOpenAIBadRequestError(error)
  ) {
    return
  }
  const candidate = error as {
    name?: unknown
    message?: unknown
    status?: unknown
    code?: unknown
    type?: unknown
    param?: unknown
    requestID?: unknown
    headers?: Record<string, unknown>
    error?: unknown
  }
  console.error('[Skillify][OpenAI] BadRequestError diagnostics', {
    sdkError: {
      name: candidate.name,
      message: candidate.message,
      status: candidate.status,
      code: candidate.code,
      type: candidate.type,
      param: candidate.param,
      requestId: candidate.requestID ?? candidate.headers?.['x-request-id'],
      responseBody: candidate.error,
    },
    requestBody,
  })
}

function logOpenAIProviderDiagnostics({
  providerError,
  config,
  requestId,
  selectedModel,
  error,
}: {
  providerError: AIProviderError
  config: OpenAIProviderConfig
  requestId: string
  selectedModel?: string
  error?: unknown
}) {
  if (process.env.NODE_ENV === 'production') return
  console.error('[Skillify][OpenAI] Provider diagnostics', {
    requestId,
    provider: 'openai',
    selectedModel: selectedModel ?? config.defaultModel,
    apiKeyDetected: Boolean(config.apiKey?.trim()),
    featureFlagStatus: 'not configured',
    providerEnabled: config.enabled,
    environmentVariableNamesChecked: openAIEnvironmentVariableNames,
    unavailableCondition: providerError.metadata?.condition,
    safeCode: providerError.code,
    safeMessage: providerError.message,
    retryable: providerError.retryable,
    originalExceptionClass:
      error instanceof Error ? error.constructor.name : undefined,
    originalExceptionMessage:
      error instanceof Error ? error.message : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  })
}

function openAIConfigurationMetadata({
  config,
  requestId,
  condition,
  selectedModel,
}: {
  config: OpenAIProviderConfig
  requestId: string
  condition: string
  selectedModel?: string
}) {
  return {
    requestId,
    condition,
    apiKeyDetected: Boolean(config.apiKey?.trim()),
    providerEnabled: config.enabled,
    selectedModel: selectedModel ?? config.defaultModel,
    environmentVariableNamesChecked: openAIEnvironmentVariableNames,
  }
}

function openAIErrorMetadata(error: APIError) {
  const candidate = error as {
    status?: unknown
    code?: unknown
    type?: unknown
    param?: unknown
    requestID?: unknown
    headers?: Record<string, unknown>
    error?: unknown
  }
  const directError = isRecord(candidate.error) ? candidate.error : undefined
  const nestedError =
    directError && isRecord(directError.error) ? directError.error : directError
  return {
    status: candidate.status,
    code: candidate.code ?? nestedError?.code,
    type: candidate.type ?? nestedError?.type,
    param: candidate.param ?? nestedError?.param,
    requestId: candidate.requestID ?? candidate.headers?.['x-request-id'],
  }
}

function isModelErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('model') &&
    (normalized.includes('does not exist') ||
      normalized.includes('not found') ||
      normalized.includes('invalid model') ||
      normalized.includes('model invalid'))
  )
}

function isOpenAIBadRequestError(error: unknown) {
  return (
    error instanceof BadRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status?: unknown }).status === 400)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const openAIEnvironmentVariableNames = [
  'OPENAI_API_KEY',
  'OPENAI_DEFAULT_MODEL',
  'OPENAI_REASONING_MODEL',
  'OPENAI_EMBEDDING_MODEL',
  'OPENAI_TIMEOUT_MS',
  'OPENAI_MAX_RETRIES',
]

/*
 * Model compatibility notes:
 * - gpt-4.1-mini and gpt-4.1 accept deterministic temperature with Responses
 *   structured outputs.
 * - o-series reasoning models such as o4-mini reject the temperature field.
 */
function selectOpenAIModel(
  request: StructuredAIRequest,
  config: OpenAIProviderConfig,
) {
  return request.prompt.requestedOutput.capabilities.includes(
    'supportsExplanation',
  ) || request.outputSchema.type === 'analysis'
    ? config.reasoningModel
    : config.defaultModel
}

function toOpenAIGenerationResponse({
  request,
  response,
  fallbackModel,
  latencyMs,
}: {
  request: StructuredAIRequest
  response: OpenAIResponseLike
  fallbackModel: string
  latencyMs: number
}): AIProviderGenerateResponse {
  const output = parseOpenAIStructuredOutput({
    text: response.output_text,
    request,
  })
  return {
    providerId: OPENAI_GENERATION_PROVIDER_ID,
    modelId: response.model ?? fallbackModel,
    output,
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      metadata: {
        totalTokens: response.usage?.total_tokens,
        latencyMs,
        model: response.model ?? fallbackModel,
        provider: 'openai',
        estimatedCostUsd: undefined,
      },
    },
    rawResponseReference: response.id,
  }
}

function toOpenAIEmbeddingResponse({
  response,
  fallbackModel,
  latencyMs,
}: {
  response: OpenAIEmbeddingResponseLike
  fallbackModel: string
  latencyMs: number
}): AIEmbeddingResponse {
  const embeddings = [...response.data]
    .sort((first, second) => (first.index ?? 0) - (second.index ?? 0))
    .map((item) => item.embedding)
  return {
    providerId: OPENAI_EMBEDDING_PROVIDER_ID,
    modelId: response.model ?? fallbackModel,
    embeddings,
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: 0,
      vectorCount: embeddings.length,
      metadata: {
        totalTokens: response.usage?.total_tokens,
        latencyMs,
        model: response.model ?? fallbackModel,
        provider: 'openai',
        estimatedCostUsd: undefined,
      },
    },
  }
}

function parseOpenAIStructuredOutput({
  text,
  request,
}: {
  text?: string
  request: StructuredAIRequest
}): StructuredAIOutput {
  if (!text) {
    throw new AIProviderException({
      code: 'OPENAI_UNKNOWN_FAILURE',
      message: 'OpenAI response did not include structured output text.',
      providerId: OPENAI_GENERATION_PROVIDER_ID,
      retryable: false,
    })
  }
  try {
    return normalizeStructuredOutput(JSON.parse(text), request)
  } catch {
    throw new AIProviderException({
      code: 'OPENAI_UNKNOWN_FAILURE',
      message: 'OpenAI response was not valid structured JSON.',
      providerId: OPENAI_GENERATION_PROVIDER_ID,
      retryable: false,
    })
  }
}

function normalizeStructuredOutput(
  value: unknown,
  request: StructuredAIRequest,
): StructuredAIOutput {
  const candidate = value as Partial<StructuredAIOutput>
  const normalizedCitations = normalizeValidatedCitationIds({
    citations: candidate.citations,
    allowedReferences: request.prompt.knowledgeReferences,
  })
  return {
    intent: request.intent,
    type: candidate.type ?? request.outputSchema.type,
    confidence: normalizeConfidence(candidate.confidence),
    answer: candidate.answer,
    recommendations: normalizeArray<WorkspaceRecommendation>(
      candidate.recommendations,
    ),
    actionProposals: normalizeProviderActionProposals(
      candidate.actionProposals,
    ),
    toolRequests: normalizeProviderToolRequests(
      candidate.toolRequests,
      request,
    ),
    reasoningSummary: candidate.reasoningSummary,
    warnings: [
      ...(normalizeArray<AIRuntimeWarning>(candidate.warnings) ?? []),
      ...(normalizedCitations.invalidCitationCount > 0
        ? [
            {
              code: 'invalid-citation',
              message: 'One supporting reference could not be validated.',
              severity: 'warning' as const,
            },
          ]
        : []),
    ],
    citations: normalizedCitations.citations,
    followUpSuggestions: normalizeArray<string>(candidate.followUpSuggestions),
    executionRequests: normalizeArray<unknown>(candidate.executionRequests),
  }
}

function normalizeProviderToolRequests(
  value: unknown,
  request: StructuredAIRequest,
): ToolRequest[] | undefined {
  if (!Array.isArray(value)) return undefined
  const allowedToolIds = new Set(request.allowedTools.map((tool) => tool.id))
  const requests: ToolRequest[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const record = item as Partial<ToolRequest>
    const toolId = typeof record.toolId === 'string' ? record.toolId.trim() : ''
    if (
      !toolId ||
      toolId.toLowerCase() === 'undefined' ||
      toolId.toLowerCase() === 'null' ||
      !allowedToolIds.has(toolId) ||
      seen.has(toolId)
    ) {
      continue
    }
    seen.add(toolId)
    requests.push({
      id:
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `tool-request:${toolId}`,
      toolId,
      intent: request.intent,
      reason:
        typeof record.reason === 'string' && record.reason.trim()
          ? record.reason.trim()
          : 'Validated OpenAI tool request.',
      parameters:
        record.parameters && typeof record.parameters === 'object'
          ? record.parameters
          : undefined,
    })
  }
  return requests
}

function normalizeConfidence(value: unknown): AIRuntimeConfidence {
  return value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'unknown'
    ? value
    : 'unknown'
}

function normalizeProviderActionProposals(
  value: unknown,
): ActionProposal[] | undefined {
  const proposals = normalizeArray<ActionProposal>(value)
  if (!proposals) return undefined
  const normalized = proposals.filter(
    (proposal) =>
      proposal &&
      typeof proposal.id === 'string' &&
      proposal.id.trim().length > 0 &&
      typeof proposal.actionType === 'string' &&
      proposal.actionType.trim().length > 0,
  )
  return normalized.length ? normalized : undefined
}

function normalizeArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined
}

function normalizePositiveInteger(
  override: number | undefined,
  envValue: string | undefined,
  fallback: number,
) {
  const value = override ?? Number(envValue)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function normalizeRetryCount(
  override: number | undefined,
  envValue: string | undefined,
  fallback: number,
) {
  const value = override ?? Number(envValue)
  if (!Number.isFinite(value) || value < 0) return fallback
  return Math.min(3, Math.floor(value))
}

const structuredAIOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'type', 'confidence'],
  properties: {
    intent: { type: 'string' },
    type: {
      type: 'string',
      enum: [
        'answer',
        'recommendations',
        'actionProposals',
        'explanation',
        'summary',
        'analysis',
      ],
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'unknown'],
    },
    answer: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        details: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    recommendations: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    actionProposals: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    toolRequests: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    reasoningSummary: { type: 'string' },
    warnings: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    citations: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    followUpSuggestions: {
      type: 'array',
      items: { type: 'string' },
    },
    executionRequests: {
      type: 'array',
      items: {},
    },
  },
}

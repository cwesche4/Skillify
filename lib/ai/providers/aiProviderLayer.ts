import type {
  AIRuntimeConfidence,
  AIRuntimeOutputType,
  AIRuntimeWarning,
  StructuredAIOutput,
  StructuredAIRequest,
} from '@/lib/ai/runtime/workspaceAIRuntime'

export type AIProviderId = string
export type AIModelId = string

export type AIProviderCapabilityKey =
  | 'structuredOutput'
  | 'toolCalling'
  | 'reasoning'
  | 'vision'
  | 'images'
  | 'streaming'
  | 'embeddings'
  | 'audio'
  | 'longContext'
  | 'jsonMode'
  | 'mcp'

export type AIProviderCapabilities = Record<AIProviderCapabilityKey, boolean>

export type AIProviderHealthStatus =
  | 'healthy'
  | 'unavailable'
  | 'degraded'
  | 'disabled'

export type AIProviderAvailability = {
  status: AIProviderHealthStatus
  reason?: string
  checkedAt?: string
}

export type AIProviderUsage = {
  inputTokens?: number
  outputTokens?: number
  vectorCount?: number
  metadata?: Record<string, unknown>
}

export type AIProviderError = {
  code: string
  message: string
  providerId: AIProviderId
  retryable: boolean
  metadata?: Record<string, unknown>
}

export class AIProviderException extends Error {
  readonly providerError: AIProviderError

  constructor(providerError: AIProviderError) {
    super(providerError.message)
    this.name = 'AIProviderException'
    this.providerError = providerError
  }
}

export function isAIProviderException(
  error: unknown,
): error is AIProviderException {
  return error instanceof AIProviderException
}

export type AIProviderBase = {
  id: AIProviderId
  label: string
  displayName: string
  version: string
  health: AIProviderAvailability
  availability: AIProviderAvailability
}

export type AIProviderModel = {
  id: AIModelId
  label: string
  capabilities: Partial<AIProviderCapabilities>
  contextWindowTokens?: number
  defaultOutputType?: AIRuntimeOutputType
}

export type AIProviderGenerateResponse = {
  providerId: AIProviderId
  modelId?: AIModelId
  output: StructuredAIOutput
  usage?: AIProviderUsage
  rawResponseReference?: string
}

export type AIProvider = AIProviderBase & {
  supportedModels: AIProviderModel[]
  capabilities: AIProviderCapabilities
  generate: (
    request: StructuredAIRequest,
  ) => Promise<AIProviderGenerateResponse>
  stream?: (
    request: StructuredAIRequest,
  ) => AsyncIterable<AIProviderGenerateResponse>
  supportsStructuredOutput: () => boolean
  supportsTools: () => boolean
  supportsImages: () => boolean
  supportsReasoning: () => boolean
  supportsVision: () => boolean
  supportsStreaming: () => boolean
}

export type AIEmbeddingVector = number[]

export type AIEmbeddingRequest = {
  id: string
  input: string[]
  modelId?: AIModelId
  metadata?: Record<string, unknown>
}

export type AIEmbeddingResponse = {
  providerId: AIProviderId
  modelId?: AIModelId
  embeddings: AIEmbeddingVector[]
  usage?: AIProviderUsage
  rawResponseReference?: string
}

export type AIEmbeddingProvider = AIProviderBase & {
  supportedEmbeddingModels: AIProviderModel[]
  embed: (request: AIEmbeddingRequest) => Promise<AIEmbeddingResponse>
  supportsEmbeddings: () => boolean
}

export type AIProviderRegistry = {
  list: () => AIProvider[]
  register: (provider: AIProvider) => AIProviderRegistry
  get: (providerId?: AIProviderId) => AIProvider | null
  getDefault: () => AIProvider | null
  setDefaultProvider: (providerId: AIProviderId) => AIProviderRegistry
  providersWithCapability: (capability: AIProviderCapabilityKey) => AIProvider[]
  getCapabilities: (providerId: AIProviderId) => AIProviderCapabilities | null
  getHealth: (providerId: AIProviderId) => AIProviderAvailability | null
  getAvailability: (providerId: AIProviderId) => AIProviderAvailability | null
  isAvailable: (providerId: AIProviderId) => boolean
}

export type AIEmbeddingProviderRegistry = {
  list: () => AIEmbeddingProvider[]
  register: (provider: AIEmbeddingProvider) => AIEmbeddingProviderRegistry
  get: (providerId?: AIProviderId) => AIEmbeddingProvider | null
  getDefault: () => AIEmbeddingProvider | null
  setDefaultProvider: (providerId: AIProviderId) => AIEmbeddingProviderRegistry
  getHealth: (providerId: AIProviderId) => AIProviderAvailability | null
  getAvailability: (providerId: AIProviderId) => AIProviderAvailability | null
  isAvailable: (providerId: AIProviderId) => boolean
}

export const defaultAIProviderCapabilities: AIProviderCapabilities = {
  structuredOutput: false,
  toolCalling: false,
  reasoning: false,
  vision: false,
  images: false,
  streaming: false,
  embeddings: false,
  audio: false,
  longContext: false,
  jsonMode: false,
  mcp: false,
}

export const mockAIProviderCapabilities: AIProviderCapabilities = {
  ...defaultAIProviderCapabilities,
  structuredOutput: true,
  toolCalling: true,
  reasoning: true,
  jsonMode: true,
}

export function createAIProviderRegistry({
  providers = [],
  defaultProviderId,
}: {
  providers?: AIProvider[]
  defaultProviderId?: AIProviderId
} = {}): AIProviderRegistry {
  assertUniqueProviderIds(providers)
  const providerMap = new Map(
    providers.map((provider) => [provider.id, provider]),
  )
  let currentDefaultProviderId = defaultProviderId ?? providers[0]?.id

  const registry: AIProviderRegistry = {
    list() {
      return [...providerMap.values()].sort((first, second) =>
        first.id.localeCompare(second.id),
      )
    },
    register(provider) {
      assertProviderIdAvailable(providerMap, provider.id)
      providerMap.set(provider.id, provider)
      currentDefaultProviderId ??= provider.id
      return registry
    },
    get(providerId) {
      if (!providerId) return registry.getDefault()
      return providerMap.get(providerId) ?? null
    },
    getDefault() {
      return currentDefaultProviderId
        ? (providerMap.get(currentDefaultProviderId) ?? null)
        : null
    },
    setDefaultProvider(providerId) {
      if (!providerMap.has(providerId)) {
        throw new Error(`AI provider ${providerId} is not registered.`)
      }
      currentDefaultProviderId = providerId
      return registry
    },
    providersWithCapability(capability) {
      return registry
        .list()
        .filter((provider) => provider.capabilities[capability])
    },
    getCapabilities(providerId) {
      return providerMap.get(providerId)?.capabilities ?? null
    },
    getHealth(providerId) {
      return providerMap.get(providerId)?.health ?? null
    },
    getAvailability(providerId) {
      return providerMap.get(providerId)?.availability ?? null
    },
    isAvailable(providerId) {
      const availability = registry.getAvailability(providerId)
      return (
        availability?.status === 'healthy' ||
        availability?.status === 'degraded'
      )
    },
  }

  return registry
}

export function createAIEmbeddingProviderRegistry({
  providers = [],
  defaultProviderId,
}: {
  providers?: AIEmbeddingProvider[]
  defaultProviderId?: AIProviderId
} = {}): AIEmbeddingProviderRegistry {
  assertUniqueProviderIds(providers)
  const providerMap = new Map(
    providers.map((provider) => [provider.id, provider]),
  )
  let currentDefaultProviderId = defaultProviderId ?? providers[0]?.id

  const registry: AIEmbeddingProviderRegistry = {
    list() {
      return [...providerMap.values()].sort((first, second) =>
        first.id.localeCompare(second.id),
      )
    },
    register(provider) {
      assertProviderIdAvailable(providerMap, provider.id)
      providerMap.set(provider.id, provider)
      currentDefaultProviderId ??= provider.id
      return registry
    },
    get(providerId) {
      if (!providerId) return registry.getDefault()
      return providerMap.get(providerId) ?? null
    },
    getDefault() {
      return currentDefaultProviderId
        ? (providerMap.get(currentDefaultProviderId) ?? null)
        : null
    },
    setDefaultProvider(providerId) {
      if (!providerMap.has(providerId)) {
        throw new Error(
          `AI embedding provider ${providerId} is not registered.`,
        )
      }
      currentDefaultProviderId = providerId
      return registry
    },
    getHealth(providerId) {
      return providerMap.get(providerId)?.health ?? null
    },
    getAvailability(providerId) {
      return providerMap.get(providerId)?.availability ?? null
    },
    isAvailable(providerId) {
      const availability = registry.getAvailability(providerId)
      return (
        availability?.status === 'healthy' ||
        availability?.status === 'degraded'
      )
    },
  }

  return registry
}

export type MockAIProviderOptions = {
  id?: AIProviderId
  displayName?: string
  version?: string
  health?: AIProviderAvailability
  availability?: AIProviderAvailability
  output?: Partial<StructuredAIOutput>
  confidence?: AIRuntimeConfidence
}

export function createMockAIProvider({
  id = 'mock-ai-provider',
  displayName = 'Mock AI Provider',
  version = 'foundation',
  health = { status: 'healthy' },
  availability = health,
  output = {},
  confidence = 'high',
}: MockAIProviderOptions = {}): AIProvider {
  const provider: AIProvider = {
    id,
    label: displayName,
    displayName,
    version,
    supportedModels: [
      {
        id: `${id}:deterministic-structured`,
        label: 'Deterministic structured model',
        capabilities: mockAIProviderCapabilities,
        defaultOutputType: output.type,
      },
    ],
    capabilities: mockAIProviderCapabilities,
    health,
    availability,
    async generate(request) {
      return {
        providerId: id,
        modelId: `${id}:deterministic-structured`,
        output: createMockStructuredOutput({
          request,
          output,
          confidence,
        }),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
        rawResponseReference: `mock-response:${request.id}`,
      }
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

export const mockAIProvider = createMockAIProvider()

export const aiProviderRegistry = createAIProviderRegistry({
  providers: [mockAIProvider],
  defaultProviderId: mockAIProvider.id,
})

export function createMockAIEmbeddingProvider({
  id = 'mock-ai-embedding-provider',
  displayName = 'Mock AI Embedding Provider',
  version = 'foundation',
  health = { status: 'healthy' },
  availability = health,
}: Omit<
  MockAIProviderOptions,
  'output' | 'confidence'
> = {}): AIEmbeddingProvider {
  return {
    id,
    label: displayName,
    displayName,
    version,
    health,
    availability,
    supportedEmbeddingModels: [
      {
        id: `${id}:deterministic-embedding`,
        label: 'Deterministic embedding model',
        capabilities: {
          embeddings: true,
        },
      },
    ],
    async embed(request) {
      return {
        providerId: id,
        modelId: request.modelId ?? `${id}:deterministic-embedding`,
        embeddings: request.input.map(createDeterministicEmbedding),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          vectorCount: request.input.length,
        },
        rawResponseReference: `mock-embedding-response:${request.id}`,
      }
    },
    supportsEmbeddings: () => true,
  }
}

export const mockAIEmbeddingProvider = createMockAIEmbeddingProvider()

export const aiEmbeddingProviderRegistry = createAIEmbeddingProviderRegistry()

function createMockStructuredOutput({
  request,
  output,
  confidence,
}: {
  request: StructuredAIRequest
  output: Partial<StructuredAIOutput>
  confidence: AIRuntimeConfidence
}): StructuredAIOutput {
  const warnings: AIRuntimeWarning[] = output.warnings ?? []
  return {
    intent: output.intent ?? request.intent,
    type: output.type ?? request.outputSchema.type,
    confidence: output.confidence ?? confidence,
    answer: output.answer ?? {
      summary: `Mock response for ${request.intent}.`,
    },
    recommendations: output.recommendations,
    actionProposals: output.actionProposals,
    toolRequests: output.toolRequests,
    reasoningSummary:
      output.reasoningSummary ??
      'Deterministic mock provider response. No external model was called.',
    warnings,
    citations: output.citations ?? request.prompt.knowledgeReferences,
    followUpSuggestions: output.followUpSuggestions ?? [
      'Review the deterministic mock response.',
    ],
    executionRequests: output.executionRequests,
  }
}

function createDeterministicEmbedding(input: string): AIEmbeddingVector {
  const normalized = input.trim().toLowerCase()
  const vector = [0, 0, 0, 0, 0, 0]
  for (let index = 0; index < normalized.length; index += 1) {
    const bucket = index % vector.length
    vector[bucket] += normalized.charCodeAt(index) / 255
  }
  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value ** 2, 0),
  )
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude)
}

function assertUniqueProviderIds(providers: Array<AIProviderBase>) {
  const ids = new Set<string>()
  for (const provider of providers) {
    if (ids.has(provider.id)) {
      throw new Error(`AI provider ${provider.id} is already registered.`)
    }
    ids.add(provider.id)
  }
}

function assertProviderIdAvailable(
  providerMap: Map<AIProviderId, AIProviderBase>,
  providerId: AIProviderId,
) {
  if (providerMap.has(providerId)) {
    throw new Error(`AI provider ${providerId} is already registered.`)
  }
}

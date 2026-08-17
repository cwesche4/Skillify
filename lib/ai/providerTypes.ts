export type {
  AIEmbeddingProvider,
  AIEmbeddingProviderRegistry,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIProvider,
  AIProviderAvailability,
  AIProviderBase,
  AIProviderCapabilities,
  AIProviderCapabilityKey,
  AIProviderError,
  AIProviderGenerateResponse,
  AIProviderHealthStatus,
  AIProviderModel,
  AIProviderRegistry,
  AIProviderUsage,
} from '@/lib/ai/providers/aiProviderLayer'

export {
  aiEmbeddingProviderRegistry,
  aiProviderRegistry,
  createAIEmbeddingProviderRegistry,
  createAIProviderRegistry,
  createMockAIEmbeddingProvider,
  createMockAIProvider,
  mockAIEmbeddingProvider,
  mockAIProvider,
} from '@/lib/ai/providers/aiProviderLayer'

export {
  OPENAI_EMBEDDING_PROVIDER_ID,
  OPENAI_GENERATION_PROVIDER_ID,
  createOpenAIEmbeddingProvider,
  createOpenAIEmbeddingProviderRegistry,
  createOpenAIGenerationProvider,
  createOpenAIProviderRegistry,
  normalizeOpenAIProviderError,
  openAIEmbeddingModels,
  openAIGenerationModels,
  resolveOpenAIProviderConfig,
} from '@/lib/ai/providers/openAIProvider'

export type {
  CreateOpenAIEmbeddingProviderOptions,
  CreateOpenAIGenerationProviderOptions,
  OpenAIEmbeddingClient,
  OpenAIEmbeddingResponseLike,
  OpenAIGenerationClient,
  OpenAIProviderConfig,
  OpenAIResponseLike,
} from '@/lib/ai/providers/openAIProvider'

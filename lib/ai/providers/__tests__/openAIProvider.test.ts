import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from 'openai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AIProviderException,
  createAIEmbeddingProviderRegistry,
} from '@/lib/ai/providers/aiProviderLayer'
import {
  OPENAI_EMBEDDING_PROVIDER_ID,
  OPENAI_GENERATION_PROVIDER_ID,
  createOpenAIEmbeddingProvider,
  createOpenAIEmbeddingProviderRegistry,
  createOpenAIGenerationProvider,
  createOpenAIProviderRegistry,
  normalizeOpenAIProviderError,
  resolveOpenAIProviderConfig,
  type OpenAIEmbeddingClient,
  type OpenAIGenerationClient,
} from '@/lib/ai/providers/openAIProvider'
import {
  WorkspaceAIRuntime,
  createAIRuntimeRegistry,
  type AIRuntimeRequest,
  type StructuredAIOutput,
  type StructuredAIRequest,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import { semanticSearch } from '@/lib/ai/search'

const now = new Date('2026-07-30T16:00:00.000Z')

const structuredOutput: StructuredAIOutput = {
  intent: 'scheduling.findBestMember',
  type: 'answer',
  confidence: 'high',
  answer: {
    summary: 'OpenAI structured response.',
    details: ['Validated through the provider abstraction.'],
  },
  citations: [],
  warnings: [],
  followUpSuggestions: ['Review the proposed schedule.'],
}

const structuredRequest: StructuredAIRequest = {
  id: 'openai-structured-request-1',
  intent: 'scheduling.findBestMember',
  prompt: {
    intent: 'scheduling.findBestMember',
    systemContext: {
      runtime: 'WorkspaceAIRuntime',
      version: 'foundation',
      executionBoundary: 'propose-only',
    },
    workspaceContext: {
      workspace: {
        id: 'workspace-openai',
        slug: 'openai-test',
        name: 'OpenAI Test',
        timezone: 'America/New_York',
      },
      actor: {
        workspaceMemberId: 'member-owner',
        role: 'OWNER',
        permissions: ['workspace:read'],
      },
      language: 'en',
      enabledModules: ['scheduling'],
      availableProviders: [],
      capabilities: [],
      systemHealth: {
        status: 'ready',
        warnings: [],
      },
    },
    workspaceState: {
      workspaceId: 'workspace-openai',
      createdAt: now.toISOString(),
      contextReferenceIds: [],
      snapshotReferenceIds: [],
      note: 'deterministic-workspace-state',
    },
    reasoningSnapshot: {} as any,
    knowledgeReferences: [],
    toolMetadata: [],
    requestedOutput: {
      type: 'answer',
      capabilities: [],
    },
    constraints: ['Do not execute business logic.'],
  },
  outputSchema: {
    type: 'answer',
    requiredFields: ['intent', 'type', 'confidence'],
    supportsActionProposals: false,
    supportsToolRequests: false,
  },
  allowedTools: [],
  knowledgeProviderMetadata: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function runtimeRequest(
  overrides: Partial<AIRuntimeRequest> = {},
): AIRuntimeRequest {
  return {
    id: 'openai-runtime-request-1',
    actor: {
      userId: 'user-owner',
      workspaceMemberId: 'member-owner',
      role: 'OWNER',
      permissions: ['workspace:read', 'scheduling:read'],
    },
    workspace: {
      id: 'workspace-openai',
      slug: 'openai-test',
      name: 'OpenAI Test',
      timezone: 'America/New_York',
    },
    requestedIntent: 'scheduling.findBestMember',
    requestedOutputType: 'answer',
    executionMode: 'modelDraft',
    now,
    ...overrides,
  }
}

function generationClient({
  output = structuredOutput,
  model = 'gpt-4.1-mini',
  responseId = 'resp-openai-1',
  failOnce,
}: {
  output?: StructuredAIOutput
  model?: string
  responseId?: string
  failOnce?: Error
} = {}) {
  const captured: Record<string, unknown>[] = []
  let calls = 0
  const client: OpenAIGenerationClient = {
    responses: {
      create: vi.fn(async (body) => {
        captured.push(body)
        calls += 1
        if (calls === 1 && failOnce) {
          throw failOnce
        }
        return {
          id: responseId,
          model,
          output_text: JSON.stringify(output),
          usage: {
            input_tokens: 20,
            output_tokens: 10,
            total_tokens: 30,
          },
        }
      }),
    },
  }
  return { client, captured }
}

function embeddingClient() {
  const captured: Record<string, unknown>[] = []
  const client: OpenAIEmbeddingClient = {
    embeddings: {
      create: vi.fn(async (body) => {
        captured.push(body)
        const input = body.input as string[]
        return {
          model: body.model as string,
          data: input.map((value, index) => ({
            index,
            embedding: value.toLowerCase().includes('alpha') ? [1, 0] : [0, 1],
          })),
          usage: {
            prompt_tokens: input.length,
            total_tokens: input.length,
          },
        }
      }),
    },
  }
  return { client, captured }
}

function createBadRequestError() {
  return new BadRequestError(
    400,
    {
      error: {
        message:
          "Unsupported parameter: 'temperature' is not supported with this model.",
        type: 'invalid_request_error',
        param: 'temperature',
        code: null,
      },
    },
    "Unsupported parameter: 'temperature' is not supported with this model.",
    new Headers({ 'x-request-id': 'req_openai_test' }),
  )
}

function createAuthenticationError() {
  return new AuthenticationError(
    401,
    {
      error: {
        message: 'Incorrect API key provided.',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      },
    },
    'Incorrect API key provided.',
    new Headers({ 'x-request-id': 'req_auth_test' }),
  )
}

function createRateLimitError() {
  return new RateLimitError(
    429,
    {
      error: {
        message: 'Rate limit reached.',
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
      },
    },
    'Rate limit reached.',
    new Headers({ 'x-request-id': 'req_rate_limit_test' }),
  )
}

describe('OpenAI provider layer', () => {
  it('registers the OpenAI generation provider with production capabilities', () => {
    const registry = createOpenAIProviderRegistry({
      config: { apiKey: 'sk-test' },
      client: generationClient().client,
    })

    expect(registry.getDefault()?.id).toBe(OPENAI_GENERATION_PROVIDER_ID)
    expect(registry.getHealth(OPENAI_GENERATION_PROVIDER_ID)?.status).toBe(
      'healthy',
    )
    expect(
      registry.getCapabilities(OPENAI_GENERATION_PROVIDER_ID),
    ).toMatchObject({
      structuredOutput: true,
      toolCalling: true,
      reasoning: true,
      jsonMode: true,
    })
    expect(
      registry.getDefault()?.supportedModels.map((model) => model.id),
    ).toEqual(['gpt-4.1-mini', 'gpt-4.1', 'o4-mini'])
  })

  it('marks OpenAI disabled when no API key is configured and throws normalized errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: '' },
      client: generationClient().client,
    })

    expect(provider.health).toMatchObject({
      status: 'disabled',
      reason: 'OPENAI_API_KEY is not configured.',
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_API_KEY_MISSING',
        providerId: OPENAI_GENERATION_PROVIDER_ID,
        retryable: false,
      },
    })
  })

  it('marks OpenAI disabled when the provider is explicitly disabled', async () => {
    const diagnostic = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test', enabled: false },
      client: generationClient().client,
    })

    expect(provider.health).toMatchObject({
      status: 'disabled',
      reason: 'OpenAI provider is disabled by provider configuration.',
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_PROVIDER_DISABLED',
        retryable: false,
        metadata: expect.objectContaining({
          apiKeyDetected: true,
          providerEnabled: false,
          condition: 'provider configuration disabled',
        }),
      },
    })
    expect(diagnostic).toHaveBeenCalledWith(
      '[Skillify][OpenAI] Provider diagnostics',
      expect.objectContaining({
        requestId: structuredRequest.id,
        apiKeyDetected: true,
        providerEnabled: false,
        unavailableCondition: 'provider configuration disabled',
        safeCode: 'OPENAI_PROVIDER_DISABLED',
      }),
    )
  })

  it('rejects invalid configured models before invoking the OpenAI client', async () => {
    const diagnostic = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { client } = generationClient()
    const provider = createOpenAIGenerationProvider({
      config: {
        apiKey: 'sk-test',
        defaultModel: 'not-a-real-openai-model',
      },
      client,
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_MODEL_INVALID',
        retryable: false,
        metadata: expect.objectContaining({
          selectedModel: 'not-a-real-openai-model',
          condition: 'unsupported model',
        }),
      },
    })
    expect(client.responses.create).not.toHaveBeenCalled()
    expect(diagnostic).toHaveBeenCalledWith(
      '[Skillify][OpenAI] Provider diagnostics',
      expect.objectContaining({
        selectedModel: 'not-a-real-openai-model',
        safeCode: 'OPENAI_MODEL_INVALID',
      }),
    )
  })

  it('requests OpenAI structured output and returns parsed provider usage metadata', async () => {
    const { client, captured } = generationClient()
    const provider = createOpenAIGenerationProvider({
      config: {
        apiKey: 'sk-test',
        defaultModel: 'gpt-4.1-mini',
        timeoutMs: 30_000,
      },
      client,
      now: (() => {
        const ticks = [1_000, 1_125]
        return () => ticks.shift() ?? 1_125
      })(),
    })

    const response = await provider.generate(structuredRequest)

    expect(captured[0]).toMatchObject({
      model: 'gpt-4.1-mini',
      temperature: 0,
      text: {
        format: {
          type: 'json_schema',
          name: 'skillify_structured_ai_output',
        },
      },
      metadata: {
        runtimeRequestId: structuredRequest.id,
        intent: 'scheduling.findBestMember',
        outputType: 'answer',
      },
    })
    expect(JSON.stringify(captured[0])).not.toContain('sk-test')
    expect(response).toMatchObject({
      providerId: OPENAI_GENERATION_PROVIDER_ID,
      modelId: 'gpt-4.1-mini',
      rawResponseReference: 'resp-openai-1',
      output: {
        answer: {
          summary: 'OpenAI structured response.',
        },
      },
      usage: {
        inputTokens: 20,
        outputTokens: 10,
        metadata: {
          totalTokens: 30,
          latencyMs: 125,
          provider: 'openai',
          model: 'gpt-4.1-mini',
        },
      },
    })
  })

  it('emits development trace checkpoints around the same SDK request path used by the playground', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const trace = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { client } = generationClient()
    const provider = createOpenAIGenerationProvider({
      config: {
        apiKey: 'sk-test',
        defaultModel: 'gpt-4.1-mini',
      },
      client,
    })

    await provider.generate(structuredRequest)

    const stages = trace.mock.calls
      .filter(([label]) => label === '[Skillify][OpenAI] Provider trace')
      .map(([, payload]) => (payload as { stage?: string }).stage)
    expect(stages).toEqual([
      'PROVIDER_CONFIGURATION',
      'REQUEST_SCHEMA_BUILT',
      'REQUEST_BODY_READY',
      'OPENAI_REQUEST_STARTED',
      'OPENAI_REQUEST_COMPLETED',
      'OPENAI_RESPONSE_RECEIVED',
      'NORMALIZATION_STARTED',
      'NORMALIZATION_COMPLETED',
    ])
    expect(client.responses.create).toHaveBeenCalledTimes(1)
    expect(trace).toHaveBeenCalledWith(
      '[Skillify][OpenAI] Provider trace',
      expect.objectContaining({
        stage: 'OPENAI_REQUEST_STARTED',
        requestId: structuredRequest.id,
        providerName: 'openai',
        model: 'gpt-4.1-mini',
        responseFormat: 'answer',
        schemaIdentifier: 'skillify_structured_ai_output',
        sdkRequestAttempted: true,
        requestBody: expect.objectContaining({
          hasInput: true,
          hasInstructions: true,
          responseFormat: 'json_schema',
          schemaIdentifier: 'skillify_structured_ai_output',
          requestKeys: expect.arrayContaining(['input', 'model', 'text']),
        }),
      }),
    )
  })

  it('uses the configured reasoning model for analysis requests', async () => {
    const { client, captured } = generationClient({
      output: {
        ...structuredOutput,
        type: 'analysis',
      },
      model: 'o4-mini',
    })
    const provider = createOpenAIGenerationProvider({
      config: {
        apiKey: 'sk-test',
        defaultModel: 'gpt-4.1-mini',
        reasoningModel: 'o4-mini',
      },
      client,
    })

    await provider.generate({
      ...structuredRequest,
      outputSchema: {
        ...structuredRequest.outputSchema,
        type: 'analysis',
      },
      prompt: {
        ...structuredRequest.prompt,
        requestedOutput: {
          type: 'analysis',
          capabilities: ['supportsExplanation'],
        },
      },
    })

    expect(captured[0]?.model).toBe('o4-mini')
    expect(captured[0]).not.toHaveProperty('temperature')
    expect(captured[0]).toMatchObject({
      text: {
        format: {
          type: 'json_schema',
          name: 'skillify_structured_ai_output',
        },
      },
    })
  })

  it('keeps temperature for non-reasoning GPT-4.1 models', async () => {
    const { client, captured } = generationClient({
      output: structuredOutput,
      model: 'gpt-4.1',
    })
    const provider = createOpenAIGenerationProvider({
      config: {
        apiKey: 'sk-test',
        defaultModel: 'gpt-4.1',
        reasoningModel: 'o4-mini',
      },
      client,
    })

    await provider.generate(structuredRequest)

    expect(captured[0]).toMatchObject({
      model: 'gpt-4.1',
      temperature: 0,
      text: {
        format: {
          type: 'json_schema',
        },
      },
    })
  })

  it('logs BadRequest diagnostics only in development without changing sanitized errors', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const diagnostic = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const badRequest = createBadRequestError()
    const client: OpenAIGenerationClient = {
      responses: {
        create: vi.fn(async () => {
          throw badRequest
        }),
      },
    }
    const provider = createOpenAIGenerationProvider({
      config: {
        apiKey: 'sk-test',
        defaultModel: 'gpt-4.1-mini',
      },
      client,
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_REQUEST_BUILD_FAILED',
        message: 'OpenAI rejected the generated request body.',
        retryable: false,
        metadata: expect.objectContaining({ status: 400 }),
      },
    })
    expect(diagnostic).toHaveBeenCalledWith(
      '[Skillify][OpenAI] BadRequestError diagnostics',
      expect.objectContaining({
        sdkError: expect.objectContaining({
          status: 400,
          requestId: 'req_openai_test',
          responseBody: expect.objectContaining({
            error: expect.objectContaining({
              param: 'temperature',
              type: 'invalid_request_error',
            }),
          }),
        }),
        requestBody: expect.objectContaining({
          model: 'gpt-4.1-mini',
          temperature: 0,
        }),
      }),
    )
  })

  it('does not log BadRequest diagnostics in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const diagnostic = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const client: OpenAIGenerationClient = {
      responses: {
        create: vi.fn(async () => {
          throw createBadRequestError()
        }),
      },
    }
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test' },
      client,
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_REQUEST_BUILD_FAILED',
      },
    })
    expect(diagnostic).not.toHaveBeenCalled()
  })

  it('normalizes OpenAI authentication, rate-limit, timeout, and network errors safely', () => {
    expect(
      normalizeOpenAIProviderError({
        error: createAuthenticationError(),
        providerId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    ).toMatchObject({
      code: 'OPENAI_AUTHENTICATION_FAILED',
      retryable: false,
      metadata: expect.objectContaining({
        status: 401,
        requestId: 'req_auth_test',
      }),
    })

    expect(
      normalizeOpenAIProviderError({
        error: createRateLimitError(),
        providerId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    ).toMatchObject({
      code: 'OPENAI_RATE_LIMITED',
      retryable: true,
      metadata: expect.objectContaining({
        status: 429,
        requestId: 'req_rate_limit_test',
      }),
    })

    expect(
      normalizeOpenAIProviderError({
        error: new APIConnectionTimeoutError(),
        providerId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    ).toMatchObject({
      code: 'OPENAI_TIMEOUT',
      retryable: true,
    })

    expect(
      normalizeOpenAIProviderError({
        error: new APIConnectionError({ message: 'fetch failed' }),
        providerId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    ).toMatchObject({
      code: 'OPENAI_NETWORK_ERROR',
      retryable: true,
    })
  })

  it('normalizes malformed structured output instead of leaking raw provider responses', async () => {
    const client: OpenAIGenerationClient = {
      responses: {
        create: vi.fn(async () => ({
          id: 'bad-response',
          model: 'gpt-4.1-mini',
          output_text: 'not-json',
        })),
      },
    }
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test' },
      client,
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_UNKNOWN_FAILURE',
        providerId: OPENAI_GENERATION_PROVIDER_ID,
        retryable: false,
      },
    })
    expect(client.responses.create).toHaveBeenCalledTimes(1)
  })

  it('keeps runtime intent authoritative and omits malformed provider tool requests', async () => {
    const { client } = generationClient({
      output: {
        ...structuredOutput,
        intent: 'analysis.general' as any,
        toolRequests: [
          { id: 'missing-tool', intent: 'analysis.general' } as any,
          {
            id: 'undefined-tool',
            toolId: 'undefined',
            intent: 'analysis.general',
            reason: 'Malformed provider output.',
          } as any,
          {
            id: 'unregistered-tool',
            toolId: 'workspace-intelligence.not-registered',
            intent: 'analysis.general',
            reason: 'Invented provider tool.',
          },
        ],
      },
    })
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test' },
      client,
    })

    const response = await provider.generate(structuredRequest)

    expect(response.output.intent).toBe(structuredRequest.intent)
    expect(response.output.intent).not.toBe('analysis.general')
    expect(response.output.toolRequests ?? []).toEqual([])
  })

  it('does not retry normalized non-retryable provider failures', async () => {
    const client: OpenAIGenerationClient = {
      responses: {
        create: vi.fn(async () => {
          throw new AIProviderException({
            code: 'OPENAI_REQUEST_BUILD_FAILED',
            message: 'OpenAI rejected the generated request body.',
            providerId: OPENAI_GENERATION_PROVIDER_ID,
            retryable: false,
          })
        }),
      },
    }
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test', maxRetries: 3 },
      client,
    })

    await expect(provider.generate(structuredRequest)).rejects.toMatchObject({
      providerError: {
        code: 'OPENAI_REQUEST_BUILD_FAILED',
        retryable: false,
      },
    })
    expect(client.responses.create).toHaveBeenCalledTimes(1)
  })

  it('retries transient timeout errors conservatively and never exposes raw SDK errors', async () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'AbortError' })
    const { client } = generationClient({ failOnce: timeout })
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test', maxRetries: 1 },
      client,
    })

    const response = await provider.generate(structuredRequest)

    expect(client.responses.create).toHaveBeenCalledTimes(2)
    expect(response.output.answer?.summary).toBe('OpenAI structured response.')
    expect(
      normalizeOpenAIProviderError({
        error: timeout,
        providerId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    ).toMatchObject({
      code: 'OPENAI_TIMEOUT',
      retryable: true,
    })
  })

  it('stops retrying after the configured retry budget', async () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'AbortError' })
    const client: OpenAIGenerationClient = {
      responses: {
        create: vi.fn(async () => {
          throw timeout
        }),
      },
    }
    const provider = createOpenAIGenerationProvider({
      config: { apiKey: 'sk-test', maxRetries: 1 },
      client,
    })

    await expect(provider.generate(structuredRequest)).rejects.toBeInstanceOf(
      AIProviderException,
    )
    expect(client.responses.create).toHaveBeenCalledTimes(2)
  })

  it('returns OpenAI embeddings through the embedding provider registry', async () => {
    const { client, captured } = embeddingClient()
    const provider = createOpenAIEmbeddingProvider({
      config: {
        apiKey: 'sk-test',
        embeddingModel: 'text-embedding-3-small',
      },
      client,
      now: (() => {
        const ticks = [2_000, 2_040]
        return () => ticks.shift() ?? 2_040
      })(),
    })
    const registry = createOpenAIEmbeddingProviderRegistry({
      config: {
        apiKey: 'sk-test',
        embeddingModel: 'text-embedding-3-small',
      },
      client,
    })

    expect(registry.getDefault()?.id).toBe(OPENAI_EMBEDDING_PROVIDER_ID)

    const response = await provider.embed({
      id: 'embedding-request-1',
      input: ['alpha', 'beta'],
    })

    expect(captured[0]).toEqual({
      model: 'text-embedding-3-small',
      input: ['alpha', 'beta'],
      encoding_format: 'float',
    })
    expect(response).toMatchObject({
      providerId: OPENAI_EMBEDDING_PROVIDER_ID,
      modelId: 'text-embedding-3-small',
      embeddings: [
        [1, 0],
        [0, 1],
      ],
      usage: {
        inputTokens: 2,
        outputTokens: 0,
        vectorCount: 2,
        metadata: {
          totalTokens: 2,
          latencyMs: 40,
          provider: 'openai',
        },
      },
    })
  })

  it('keeps semantic search behind the OpenAI embedding provider abstraction', async () => {
    const { client } = embeddingClient()
    const ranked = await semanticSearch(
      'alpha',
      [
        { id: 'beta', label: 'beta' },
        { id: 'alpha', label: 'alpha' },
      ],
      {
        embeddingProviders: createAIEmbeddingProviderRegistry({
          providers: [
            createOpenAIEmbeddingProvider({
              config: { apiKey: 'sk-test' },
              client,
            }),
          ],
        }),
        providerId: OPENAI_EMBEDDING_PROVIDER_ID,
      },
    )

    expect(ranked[0]?.id).toBe('alpha')
  })

  it('lets WorkspaceAIRuntime invoke OpenAI only through the AI provider registry', async () => {
    const { client } = generationClient()
    const registry = createAIRuntimeRegistry({
      aiProviders: createOpenAIProviderRegistry({
        config: { apiKey: 'sk-test' },
        client,
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        llmProviderId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    )

    expect(client.responses.create).toHaveBeenCalledTimes(1)
    expect(response.providerUsage.llmProviderId).toBe(
      OPENAI_GENERATION_PROVIDER_ID,
    )
    expect(response.events.map((event) => event.type)).toContain(
      'AIProviderInvoked',
    )
    expect(response.validation.valid).toBe(true)
    expect(response.structuredResponse.answer?.summary).toBe(
      'OpenAI structured response.',
    )
  })

  it('records the provider invocation attempt before configuration fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const registry = createAIRuntimeRegistry({
      aiProviders: createOpenAIProviderRegistry({
        config: { apiKey: '' },
        client: generationClient().client,
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        llmProviderId: OPENAI_GENERATION_PROVIDER_ID,
      }),
    )

    expect(response.providerOutcome).toBe('providerUnavailable')
    expect(response.events.map((event) => event.type)).toContain(
      'AIProviderInvoked',
    )
    expect(response.warnings.map((warning) => warning.code)).toContain(
      'OPENAI_API_KEY_MISSING',
    )
    expect(response.structuredResponse.answer?.summary).toContain(
      'OpenAI is unavailable',
    )
  })

  it('normalizes provider configuration from environment-compatible values', () => {
    const config = resolveOpenAIProviderConfig({
      apiKey: 'sk-test',
      timeoutMs: 12_345,
      maxRetries: 12,
    })

    expect(config).toMatchObject({
      apiKey: 'sk-test',
      defaultModel: 'gpt-4.1-mini',
      reasoningModel: 'o4-mini',
      embeddingModel: 'text-embedding-3-small',
      timeoutMs: 12_345,
      maxRetries: 3,
    })
  })
})

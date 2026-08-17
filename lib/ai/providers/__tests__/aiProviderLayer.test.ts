import { describe, expect, it } from 'vitest'

import {
  aiProviderRegistry,
  createAIEmbeddingProviderRegistry,
  createAIProviderRegistry,
  createMockAIEmbeddingProvider,
  createMockAIProvider,
  mockAIProviderCapabilities,
} from '@/lib/ai/providers/aiProviderLayer'
import {
  WorkspaceAIRuntime,
  createAIRuntimeRegistry,
  type AIRuntimeRequest,
  type StructuredAIRequest,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import { semanticSearch } from '@/lib/ai/search'

const now = new Date('2026-07-30T16:00:00.000Z')

const structuredRequest: StructuredAIRequest = {
  id: 'structured-request-1',
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
        id: 'workspace-1',
        slug: 'provider-test',
        name: 'Provider Test',
        timezone: 'America/New_York',
      },
      actor: {
        workspaceMemberId: 'member-1',
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
      workspaceId: 'workspace-1',
      createdAt: now.toISOString(),
      contextReferenceIds: [],
      snapshotReferenceIds: [],
      note: 'deterministic-workspace-state',
    },
    reasoningSnapshot: {} as any,
    knowledgeReferences: [
      {
        id: 'reference-1',
        providerId: 'scheduling',
        domain: 'scheduling',
        kind: 'snapshot',
        label: 'Scheduling snapshot',
        scope: 'workspace',
      },
    ],
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

function runtimeRequest(
  overrides: Partial<AIRuntimeRequest> = {},
): AIRuntimeRequest {
  return {
    id: 'provider-runtime-request-1',
    actor: {
      userId: 'user-1',
      workspaceMemberId: 'member-1',
      role: 'OWNER',
      permissions: ['workspace:read', 'scheduling:read'],
    },
    workspace: {
      id: 'workspace-1',
      slug: 'provider-test',
      name: 'Provider Test',
      timezone: 'America/New_York',
    },
    requestedIntent: 'scheduling.findBestMember',
    requestedOutputType: 'answer',
    executionMode: 'modelDraft',
    now,
    ...overrides,
  }
}

describe('AI Provider Layer foundation', () => {
  it('registers providers and resolves the default provider deterministically', () => {
    const mock = createMockAIProvider({ id: 'mock-a' })
    const other = createMockAIProvider({ id: 'mock-b' })
    const registry = createAIProviderRegistry({
      providers: [other, mock],
      defaultProviderId: 'mock-a',
    })

    expect(registry.getDefault()?.id).toBe('mock-a')
    expect(registry.get()?.id).toBe('mock-a')
    expect(registry.get('mock-b')?.displayName).toBe('Mock AI Provider')
    expect(registry.list().map((provider) => provider.id)).toEqual([
      'mock-a',
      'mock-b',
    ])
  })

  it('supports provider registration after registry creation', () => {
    const registry = createAIProviderRegistry()
    registry.register(createMockAIProvider({ id: 'registered-mock' }))

    expect(registry.getDefault()?.id).toBe('registered-mock')
    expect(registry.get('registered-mock')?.version).toBe('foundation')
  })

  it('enforces provider id uniqueness during registration', () => {
    const provider = createMockAIProvider({ id: 'duplicate-provider' })

    expect(() =>
      createAIProviderRegistry({ providers: [provider, provider] }),
    ).toThrow('AI provider duplicate-provider is already registered.')

    const registry = createAIProviderRegistry({ providers: [provider] })
    expect(() =>
      registry.register(
        createMockAIProvider({
          id: 'duplicate-provider',
        }),
      ),
    ).toThrow('AI provider duplicate-provider is already registered.')
  })

  it('looks up capabilities without exposing provider-specific logic to consumers', () => {
    const provider = createMockAIProvider({ id: 'capability-mock' })
    const registry = createAIProviderRegistry({ providers: [provider] })

    expect(registry.getCapabilities('capability-mock')).toEqual(
      mockAIProviderCapabilities,
    )
    expect(
      registry
        .providersWithCapability('structuredOutput')
        .map((item) => item.id),
    ).toEqual(['capability-mock'])
    expect(registry.providersWithCapability('embeddings')).toEqual([])
  })

  it('tracks provider health and availability states', () => {
    const unavailable = createMockAIProvider({
      id: 'disabled-mock',
      health: {
        status: 'disabled',
        reason: 'Workspace disabled this provider.',
      },
      availability: {
        status: 'unavailable',
        reason: 'Provider is unavailable.',
      },
    })
    const registry = createAIProviderRegistry({ providers: [unavailable] })

    expect(registry.getHealth('disabled-mock')).toMatchObject({
      status: 'disabled',
    })
    expect(registry.getAvailability('disabled-mock')).toMatchObject({
      status: 'unavailable',
    })
    expect(registry.isAvailable('disabled-mock')).toBe(false)
  })

  it('returns deterministic structured output from the mock provider', async () => {
    const provider = createMockAIProvider({
      id: 'deterministic-mock',
      output: {
        answer: {
          summary: 'Deterministic provider answer.',
        },
      },
    })

    const first = await provider.generate(structuredRequest)
    const second = await provider.generate(structuredRequest)

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      providerId: 'deterministic-mock',
      output: {
        intent: 'scheduling.findBestMember',
        type: 'answer',
        answer: {
          summary: 'Deterministic provider answer.',
        },
        citations: structuredRequest.prompt.knowledgeReferences,
      },
    })
  })

  it('exposes a default offline provider registry for development and CI', () => {
    expect(aiProviderRegistry.getDefault()?.id).toBe('mock-ai-provider')
    expect(aiProviderRegistry.getHealth('mock-ai-provider')?.status).toBe(
      'healthy',
    )
  })

  it('registers embedding providers separately from generation providers', async () => {
    const provider = createMockAIEmbeddingProvider({ id: 'embedding-mock' })
    const registry = createAIEmbeddingProviderRegistry({
      providers: [provider],
    })

    expect(registry.getDefault()?.id).toBe('embedding-mock')
    expect(registry.get('embedding-mock')?.supportsEmbeddings()).toBe(true)

    const response = await registry.get('embedding-mock')?.embed({
      id: 'embedding-request-1',
      input: ['alpha', 'beta'],
    })

    expect(response?.providerId).toBe('embedding-mock')
    expect(response?.embeddings).toHaveLength(2)
    expect(response?.usage?.vectorCount).toBe(2)
  })

  it('keeps semantic search behind the embedding provider abstraction', async () => {
    const items = [
      { id: 'alpha', label: 'alpha' },
      { id: 'beta', label: 'beta' },
    ]
    const unchanged = await semanticSearch('alpha', items)

    expect(unchanged).toBe(items)

    const ranked = await semanticSearch('alpha', items, {
      embeddingProviders: createAIEmbeddingProviderRegistry({
        providers: [createMockAIEmbeddingProvider({ id: 'semantic-mock' })],
      }),
    })

    expect(ranked[0]?.id).toBe('alpha')
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0)
  })

  it('lets the runtime invoke AI providers while preserving response validation', async () => {
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [
          createMockAIProvider({
            id: 'runtime-mock',
            output: {
              intent: 'workflow.generate',
              type: 'answer',
              answer: {
                summary: 'Mismatched answer.',
              },
            },
          }),
        ],
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        llmProviderId: 'runtime-mock',
      }),
    )

    expect(response.providerUsage.llmProviderId).toBe('runtime-mock')
    expect(response.events.map((event) => event.type)).toContain(
      'AIProviderInvoked',
    )
    expect(response.intent).toBe('scheduling.findBestMember')
    expect(response.structuredResponse.intent).toBe('scheduling.findBestMember')
    expect(response.validation.valid).toBe(true)
    expect(response.validation.errors.map((error) => error.code)).not.toContain(
      'intent-mismatch',
    )
  })
})

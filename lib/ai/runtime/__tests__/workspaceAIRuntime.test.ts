import { describe, expect, it } from 'vitest'

import {
  WorkspaceAIRuntime,
  buildStructuredPrompt,
  createAIRuntimeRegistry,
  selectAIRuntimeTools,
  validateStructuredAIOutput,
  type AIRuntimeRequest,
  type StructuredAIOutput,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import {
  AIProviderException,
  createAIProviderRegistry,
  createMockAIProvider,
} from '@/lib/ai/providers/aiProviderLayer'
import {
  assembleContext,
  type WorkspaceIntelligenceActor,
  type WorkspaceIntelligenceWorkspace,
  type WorkspaceRecommendation,
} from '@/lib/intelligence/workspaceIntelligence'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type { SchedulingKnowledgeInput } from '@/lib/scheduling/schedulingKnowledge'
import type {
  SchedulingEvent,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

const now = new Date('2026-07-30T14:00:00.000Z')
const workspaceId = 'runtime-workspace'

const settings = normalizeSchedulingSettings({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  workspaceTimezone: 'America/New_York',
  settings: { timezone: 'America/New_York' },
})

const schedulingCapabilities = getWorkspaceSchedulingCapabilities({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  settings,
  workspaceTimezone: 'America/New_York',
})

const workspace: WorkspaceIntelligenceWorkspace = {
  id: workspaceId,
  slug: 'runtime',
  name: 'Runtime Workspace',
  timezone: 'America/New_York',
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  enabledModules: ['scheduling', 'workflow'],
}

const owner: WorkspaceIntelligenceActor = {
  userId: 'user-owner',
  workspaceMemberId: 'member-owner',
  role: 'OWNER',
  permissions: ['workspace:read', 'scheduling:read'],
  language: 'en',
}

const members = [
  {
    id: 'member-owner',
    label: 'Owner',
    status: 'active',
    teamIds: ['team-office'],
    locationId: 'location-office',
  },
  {
    id: 'member-field',
    label: 'Field Tech',
    status: 'active',
    teamIds: ['team-field'],
    locationId: 'location-field',
  },
]

const teams = [
  {
    id: 'team-office',
    label: 'Office Team',
    memberIds: ['member-owner'],
    status: 'active',
  },
  {
    id: 'team-field',
    label: 'Field Crew',
    memberIds: ['member-field'],
    status: 'active',
  },
]

const events: SchedulingEvent[] = [
  {
    id: 'owner-busy',
    workspaceId,
    title: 'Proposal Review',
    type: 'proposalReview',
    status: 'confirmed',
    startsAt: '2026-07-30T15:00:00.000Z',
    endsAt: '2026-07-30T16:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-owner'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'field-open',
    workspaceId,
    title: 'Discovery Call',
    type: 'discoveryCall',
    status: 'scheduled',
    startsAt: '2026-07-30T15:00:00.000Z',
    endsAt: '2026-07-30T15:45:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-field'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
]

const availability: TeamAvailabilityRecord[] = [
  {
    id: 'hours',
    workspaceId,
    kind: 'workingHours',
    scope: 'workspace',
    memberId: '',
    memberName: 'Business Hours',
    daysOfWeek: [1, 2, 3, 4, 5],
    startsAt: '09:00',
    endsAt: '17:00',
    timezone: 'America/New_York',
  },
]

function schedulingSource(
  actor: SchedulingKnowledgeInput['actor'] = {
    role: 'OWNER',
    canViewAllScheduling: true,
  },
): SchedulingKnowledgeInput {
  return {
    workspace: {
      id: workspaceId,
      slug: 'runtime',
      name: 'Runtime Workspace',
      timezone: 'America/New_York',
    },
    settings,
    capabilities: schedulingCapabilities,
    now,
    actor,
    members,
    teams,
    locations: [
      { id: 'location-office', label: 'Office', status: 'active' },
      { id: 'location-field', label: 'Field', status: 'active' },
    ],
    events,
    availability,
    recurringSeries: [],
    externalAvailability: [],
    calendarConnections: [],
  }
}

function runtimeRequest(
  overrides: Partial<AIRuntimeRequest> = {},
): AIRuntimeRequest {
  return {
    id: 'runtime-request-1',
    actor: owner,
    workspace,
    requestedIntent: 'scheduling.findBestMember',
    requestedOutputType: 'recommendations',
    executionMode: 'prepareOnly',
    providerSources: { scheduling: schedulingSource() },
    now,
    ...overrides,
  }
}

function fakeProvider(output: StructuredAIOutput) {
  return createMockAIProvider({
    id: 'fake-structured-model',
    displayName: 'Fake structured model',
    output,
  })
}

function timedOutProvider() {
  return {
    ...createMockAIProvider({
      id: 'openai',
      displayName: 'OpenAI',
    }),
    async generate() {
      throw new AIProviderException({
        code: 'openai-timeout',
        message: 'OpenAI request timed out.',
        providerId: 'openai',
        retryable: true,
      })
    },
  }
}

describe('WorkspaceAIRuntime', () => {
  it('prepares a runtime request, context, tools, and structured response without invoking an LLM', async () => {
    const response = await new WorkspaceAIRuntime().run(runtimeRequest())

    expect(response.intent).toBe('scheduling.findBestMember')
    expect(response.providerUsage.knowledgeProviderIds).toEqual(['scheduling'])
    expect(response.providerUsage.llmProviderId).toBeUndefined()
    expect(response.toolUsage.eligibleToolIds).toEqual([
      'workspace-intelligence.context.assemble',
      'workspace-intelligence.recommendations.resolve',
    ])
    expect(response.toolUsage.executedToolIds).toEqual([])
    expect(response.prompt.systemContext.executionBoundary).toBe('propose-only')
    expect(response.prompt.workspaceState.note).toBe(
      'deterministic-workspace-state',
    )
    expect(response.reasoningSnapshot.immutable).toBe(true)
    expect(response.reasoningSnapshot.evidence.length).toBeGreaterThan(0)
    expect(
      response.reasoningSnapshot.investigationPlan[0]?.providerIds,
    ).toEqual(['scheduling'])
    expect(response.events.map((event) => event.type)).toContain(
      'ReasoningPrepared',
    )
    expect(response.validation.valid).toBe(true)
  })

  it('passes a complete deterministic reasoning package to the model provider before generation', async () => {
    let capturedRequest: unknown = null
    const provider = {
      ...fakeProvider({
        intent: 'scheduling.findBestMember',
        type: 'recommendations',
        confidence: 'high',
        recommendations: [],
      }),
      async generate(request: any) {
        capturedRequest = request
        return {
          providerId: 'fake-structured-model',
          output: {
            intent: 'scheduling.findBestMember',
            type: 'recommendations',
            confidence: 'high',
            recommendations: [],
          } satisfies StructuredAIOutput,
        }
      },
    }
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({ providers: [provider] }),
    })
    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        llmProviderId: 'fake-structured-model',
        allowedActionTypes: ['createTask'],
        constraints: ['User request: Why are automations failing?'],
        governedKnowledge: {
          approvedKnowledge: [
            {
              title: 'Manager approval required before executing automations.',
            },
          ],
          knowledgeGaps: [
            { title: 'OAuth provider failure details are not connected.' },
          ],
          confidence: { overall: 'medium' },
          correctionsMetadata: [],
          recommendationHistory: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
        },
      }),
    )
    const eventTypes = response.events.map((event) => event.type)

    expect(eventTypes.indexOf('ReasoningPrepared')).toBeLessThan(
      eventTypes.indexOf('AIProviderInvoked'),
    )
    expect(response.reasoningSnapshot.investigationGoal).toContain(
      'Why are automations failing?',
    )
    expect(response.reasoningSnapshot.businessRulesApplied[0]?.rule).toBe(
      'Manager approval required before executing automations.',
    )
    expect(
      response.reasoningSnapshot.missingInformation.map((item) => item.label),
    ).toContain('OAuth provider failure details are not connected.')
    expect(response.reasoningSnapshot.proposalCandidates[0]).toMatchObject({
      title: 'Prepare Create Task proposal',
      requiredApprovals: ['Workspace approval policy'],
    })
    expect(
      response.reasoningSnapshot.learningOpportunities.map((item) => item.id),
    ).toContain('learning:recurring-recommendation-history')
    expect((capturedRequest as any).prompt.reasoningSnapshot).toEqual(
      response.reasoningSnapshot,
    )
    expect((capturedRequest as any).prompt.constraints).toContain(
      'Use the Workspace Reasoning Engine snapshot as the source of reasoning, confidence, contradictions, missing data, recommendations, and proposal previews.',
    )
  })

  it('resolves intent deterministically from a scheduling hint', async () => {
    const response = await new WorkspaceAIRuntime().run(
      runtimeRequest({
        requestedIntent: undefined,
        intentHint: { domain: 'scheduling', action: 'find-slot' },
        requestedOutputType: 'answer',
      }),
    )

    expect(response.intent).toBe('scheduling.findAvailableSlot')
    expect(response.events.map((event) => event.type)).toContain(
      'IntentResolved',
    )
  })

  it('uses Workspace Intelligence permission filtering before model preparation', async () => {
    const response = await new WorkspaceAIRuntime().run(
      runtimeRequest({
        actor: {
          ...owner,
          role: 'MEMBER',
          workspaceMemberId: 'member-field',
          permissions: ['workspace:read', 'scheduling:read'],
        },
        providerSources: {
          scheduling: schedulingSource({
            workspaceMemberId: 'member-field',
            role: 'MEMBER',
            visibleMemberIds: ['member-field'],
          }),
        },
      }),
    )

    const schedulingContext =
      response.prompt.workspaceContext.availableProviders[0]
    expect(schedulingContext?.id).toBe('scheduling')
    expect(response.aiRequest.prompt.knowledgeReferences).toHaveLength(2)
    expect(response.prompt.workspaceContext).not.toHaveProperty('events')
  })

  it('selects only tools allowed by intent, capabilities, permissions, and requested allow-list', () => {
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })
    const tools = selectAIRuntimeTools({
      request: runtimeRequest({
        allowedToolIds: ['workspace-intelligence.recommendations.resolve'],
      }),
      intent: 'scheduling.findBestMember',
      assembled,
      toolMetadata:
        assembled.context.availableProviders.length > 0
          ? [
              {
                id: 'workspace-intelligence.recommendations.resolve',
                label: 'Resolve deterministic recommendations',
                supportedIntents: ['scheduling.findBestMember'],
                requiredCapabilities: ['supportsRecommendations'],
                requiredPermissions: ['workspace:read'],
                supportedProviderIds: ['scheduling'],
                executes: false,
              },
              {
                id: 'not-allowed',
                label: 'Not allowed',
                supportedIntents: ['scheduling.findBestMember'],
                requiredCapabilities: ['supportsRecommendations'],
                requiredPermissions: ['workspace:read'],
                supportedProviderIds: ['scheduling'],
                executes: false,
              },
            ]
          : [],
    })

    expect(tools.map((tool) => tool.id)).toEqual([
      'workspace-intelligence.recommendations.resolve',
    ])
  })

  it('can invoke a registered model abstraction without integrating any provider SDK', async () => {
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [
          fakeProvider({
            intent: 'scheduling.findBestMember',
            type: 'recommendations',
            confidence: 'high',
            recommendations: [],
            followUpSuggestions: ['Review the assigned member schedule.'],
          }),
        ],
      }),
    })
    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        llmProviderId: 'fake-structured-model',
      }),
    )

    expect(response.providerUsage.llmProviderId).toBe('fake-structured-model')
    expect(response.events.map((event) => event.type)).toContain(
      'AIProviderInvoked',
    )
    expect(response.followUpSuggestions).toEqual([
      'Review the assigned member schedule.',
    ])
  })

  it('reports provider timeouts as provider fallback instead of no model invocation', async () => {
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [timedOutProvider()],
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        llmProviderId: 'openai',
        requestedOutputType: 'answer',
      }),
    )

    expect(response.providerUsage.llmProviderId).toBe('openai')
    expect(response.providerOutcome).toBe('providerTimeout')
    expect(response.events.map((event) => event.type)).toContain(
      'AIProviderInvoked',
    )
    expect(response.structuredResponse.confidence).toBe('medium')
    expect(response.structuredResponse.answer?.summary).toContain(
      'OpenAI timed out',
    )
    expect(response.structuredResponse.answer?.summary).not.toContain(
      'No model provider was invoked',
    )
    expect(response.warnings.map((warning) => warning.code)).toContain(
      'openai-timeout',
    )
  })

  it('validates intent, tool, citation, action proposal, and execution boundaries', () => {
    const request = runtimeRequest({
      allowedActionTypes: ['createTask'],
    })
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })
    const selectedTools = selectAIRuntimeTools({
      request,
      intent: 'scheduling.findBestMember',
      assembled,
      toolMetadata: [
        {
          id: 'workspace-intelligence.context.assemble',
          label: 'Assemble',
          supportedIntents: ['scheduling.findBestMember'],
          requiredCapabilities: ['supportsContext'],
          requiredPermissions: ['workspace:read'],
          supportedProviderIds: ['scheduling'],
          executes: false,
        },
      ],
    })
    const validation = validateStructuredAIOutput({
      request,
      intent: 'scheduling.findBestMember',
      selectedTools,
      providerReferences: assembled.references,
      output: {
        intent: 'crm.explainRecord',
        type: 'recommendations',
        confidence: 'medium',
        toolRequests: [
          {
            id: 'tool-1',
            toolId: 'unregistered-tool',
            intent: 'scheduling.findBestMember',
            reason: 'Should be rejected.',
          },
        ],
        citations: [
          {
            id: 'missing-reference',
            providerId: 'scheduling',
            domain: 'scheduling',
            kind: 'snapshot',
            label: 'Missing',
            scope: 'provider',
          },
        ],
        actionProposals: [
          {
            id: 'action-1',
            actionType: 'sendSms',
            label: 'Send SMS',
            confidence: 'medium',
            references: [],
          },
        ],
        executionRequests: [{ type: 'execute-now' }],
      },
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'intent-mismatch',
        'invalid-tool-request',
        'invalid-citation',
        'unknown-action-proposal',
        'execution-request-rejected',
      ]),
    )
    expect(
      validation.rejectedActionProposals.map((proposal) => proposal.id),
    ).toEqual(['action-1'])
  })

  it('normalizes invalid citations without exposing undefined citation text', async () => {
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })
    const validReference = assembled.references[0]
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [
          fakeProvider({
            intent: 'scheduling.findBestMember',
            type: 'recommendations',
            confidence: 'high',
            citations: [
              validReference,
              { id: undefined } as any,
              { id: 'undefined' } as any,
              { id: 'provider-invented' } as any,
              validReference,
            ],
            recommendations: [],
          }),
        ],
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        llmProviderId: 'fake-structured-model',
      }),
    )

    expect(response.citations).toEqual([validReference])
    expect(
      response.warnings.map((warning) => warning.message).join(' '),
    ).not.toContain('Citation undefined')
    expect(response.warnings.map((warning) => warning.code)).toContain(
      'invalid-citation',
    )
    expect(response.confidence).toBe('low')
  })

  it('omits malformed provider tool requests without exposing undefined tool labels', async () => {
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [
          fakeProvider({
            intent: 'analysis.general' as any,
            type: 'answer',
            confidence: 'medium',
            answer: {
              summary: 'Provider returned malformed tool requests.',
            },
            toolRequests: [
              { id: 'missing-tool-id' } as any,
              {
                id: 'undefined-tool',
                toolId: 'undefined',
                intent: 'analysis.general' as any,
                reason: 'Malformed provider output.',
              },
              {
                id: 'unregistered-tool',
                toolId: 'workspace-intelligence.not-registered',
                intent: 'analysis.general' as any,
                reason: 'Invented provider tool.',
              },
            ],
          }),
        ],
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        llmProviderId: 'fake-structured-model',
        requestedOutputType: 'answer',
      }),
    )

    expect(response.intent).toBe('scheduling.findBestMember')
    expect(response.structuredResponse.type).toBe('answer')
    expect(response.toolUsage.requestedToolIds).toEqual([])
    expect(
      response.validation.errors.map((error) => error.message).join(' '),
    ).not.toContain('Tool request undefined')
    expect(response.warnings.map((warning) => warning.code)).toContain(
      'invalid-tool-request-omitted',
    )
  })

  it('omits undefined action proposal entries before validation', async () => {
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [
          fakeProvider({
            intent: 'scheduling.findBestMember',
            type: 'actionProposals',
            confidence: 'medium',
            actionProposals: [undefined, { id: 'missing-action-type' }] as any,
          }),
        ],
      }),
    })

    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        llmProviderId: 'fake-structured-model',
        requestedOutputType: 'actionProposals',
        allowedActionTypes: ['createTask'],
      }),
    )

    expect(response.structuredResponse.actionProposals ?? []).toEqual([])
    expect(response.validation.valid).toBe(true)
    expect(
      response.warnings.map((warning) => warning.message).join(' '),
    ).not.toContain('Action proposal undefined')
  })

  it('accepts allowed action proposals but never executes them', async () => {
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({
        providers: [
          fakeProvider({
            intent: 'scheduling.findBestMember',
            type: 'actionProposals',
            confidence: 'high',
            actionProposals: [
              {
                id: 'proposal-1',
                actionType: 'createTask',
                label: 'Create follow-up task',
                confidence: 'high',
                references: [],
              },
            ],
          }),
        ],
      }),
    })
    const response = await new WorkspaceAIRuntime(registry).run(
      runtimeRequest({
        executionMode: 'modelDraft',
        requestedOutputType: 'actionProposals',
        allowedActionTypes: ['createTask'],
      }),
    )

    expect(response.validation.valid).toBe(true)
    expect(response.recommendedActions.map((action) => action.id)).toEqual([
      'proposal-1',
    ])
    expect(response.executionRequests).toEqual([])
    expect(response.toolUsage.executedToolIds).toEqual([])
  })

  it('reports unknown intents and unsupported requested providers deterministically', async () => {
    const response = await new WorkspaceAIRuntime().run(
      runtimeRequest({
        requestedIntent: 'crm.explainRecord',
        requestedOutputType: 'explanation',
        requestedProviderIds: ['workflow' as never],
      }),
    )

    expect(response.providerUsage.knowledgeProviderIds).toEqual([])
    expect(response.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'knowledge-provider-unavailable',
        'context-assembly-warning',
      ]),
    )
    expect(response.events.map((event) => event.type)).toEqual([
      'IntentResolved',
      'ContextAssembled',
      'ToolsSelected',
      'ReasoningPrepared',
      'ResponseValidated',
      'ResponseCompleted',
    ])
  })

  it('keeps structured prompts deterministic for identical inputs', () => {
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })
    const selectedTools = selectAIRuntimeTools({
      request: runtimeRequest(),
      intent: 'scheduling.findBestMember',
      assembled,
      toolMetadata: [],
    })
    const first = buildStructuredPrompt({
      request: runtimeRequest(),
      intent: 'scheduling.findBestMember',
      assembled,
      selectedTools,
    })
    const second = buildStructuredPrompt({
      request: runtimeRequest(),
      intent: 'scheduling.findBestMember',
      assembled,
      selectedTools,
    })

    expect(first).toEqual(second)
    expect(first.constraints).toContain('Do not execute business logic.')
  })

  it('keeps runtime registry metadata separate from execution', () => {
    const provider = fakeProvider({
      intent: 'scheduling.findBestMember',
      type: 'answer',
      confidence: 'high',
    })
    const registry = createAIRuntimeRegistry({
      aiProviders: createAIProviderRegistry({ providers: [provider] }),
    })

    expect(registry.getAIProvider('fake-structured-model')).toBe(provider)
    expect(registry.outputHandlers.every((handler) => handler.validates)).toBe(
      true,
    )
    expect(
      registry
        .getToolsForIntent('scheduling.findBestMember')
        .every((tool) => tool.executes === false),
    ).toBe(true)
  })
})

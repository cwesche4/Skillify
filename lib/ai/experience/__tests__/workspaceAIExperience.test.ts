import { describe, expect, it } from 'vitest'

import type { AIRuntimeResponse } from '@/lib/ai/runtime/workspaceAIRuntime'
import { WorkspaceAIRuntime } from '@/lib/ai/runtime/workspaceAIRuntime'
import {
  createWorkspaceAIApproval,
  createWorkspaceAIEntryPointRegistry,
  createWorkspaceAIExperience,
  createWorkspaceAISession,
  getWorkspaceAIResponseRendering,
  runWorkspaceAIRequest,
  isWorkspaceAIExperienceAssemblyError,
  toRuntimeRequest,
  toWorkspaceAIResponse,
  workspaceAIEntryPointRegistry,
  type WorkspaceAIContextReference,
  type WorkspaceAIUserRequest,
} from '@/lib/ai/experience/workspaceAIExperience'
import { normalizeWorkspaceRecommendations } from '@/lib/intelligence/workspaceIntelligence'
import type {
  WorkspaceIntelligenceActor,
  WorkspaceIntelligenceWorkspace,
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
const workspaceId = 'workspace-ai-experience'

const schedulingSettings = normalizeSchedulingSettings({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  workspaceTimezone: 'America/New_York',
  settings: { timezone: 'America/New_York' },
})

const schedulingCapabilities = getWorkspaceSchedulingCapabilities({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  settings: schedulingSettings,
  workspaceTimezone: 'America/New_York',
})

const workspace: WorkspaceIntelligenceWorkspace = {
  id: workspaceId,
  slug: 'experience',
  name: 'Experience Workspace',
  timezone: 'America/New_York',
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  enabledModules: ['scheduling', 'workflow', 'crm'],
}

const actor: WorkspaceIntelligenceActor = {
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

const workflowContext: WorkspaceAIContextReference = {
  id: 'workflow:workflow-1',
  entryPointId: 'workflowBuilder',
  kind: 'workflow',
  label: 'Client follow-up workflow',
  metadata: { workflowId: 'workflow-1' },
}

const schedulingContext: WorkspaceAIContextReference = {
  id: 'event:owner-busy',
  entryPointId: 'scheduling',
  kind: 'event',
  label: 'Proposal Review',
  providerId: 'scheduling',
  referenceId: 'owner-busy',
}

function schedulingSource(
  sourceActor: SchedulingKnowledgeInput['actor'] = {
    role: 'OWNER',
    canViewAllScheduling: true,
  },
): SchedulingKnowledgeInput {
  return {
    workspace: {
      id: workspaceId,
      slug: 'experience',
      name: 'Experience Workspace',
      timezone: 'America/New_York',
    },
    settings: schedulingSettings,
    capabilities: schedulingCapabilities,
    now,
    actor: sourceActor,
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

function session() {
  return createWorkspaceAISession({
    id: 'session-1',
    workspace,
    actor,
    entryPointId: 'scheduling',
    intent: 'scheduling.findBestMember',
    contextReferences: [schedulingContext],
    conversation: {
      conversationId: 'future-conversation',
      source: 'scheduling',
    },
    now,
  })
}

function userRequest(
  overrides: Partial<WorkspaceAIUserRequest> = {},
): WorkspaceAIUserRequest {
  return {
    id: 'user-request-1',
    session: session(),
    providerSources: { scheduling: schedulingSource() },
    now,
    ...overrides,
  }
}

function runtimeResponse(
  overrides: Partial<AIRuntimeResponse> = {},
): AIRuntimeResponse {
  return {
    requestId: 'workspace-ai-runtime:user-request-1',
    intent: 'scheduling.findBestMember',
    confidence: 'high',
    providerUsage: {
      knowledgeProviderIds: ['scheduling'],
    },
    toolUsage: {
      eligibleToolIds: ['workspace-intelligence.recommendations.resolve'],
      requestedToolIds: [],
      executedToolIds: [],
    },
    knowledgeReferences: [
      {
        id: 'reference:scheduling:snapshot:1',
        providerId: 'scheduling',
        domain: 'scheduling',
        kind: 'snapshot',
        label: 'Scheduling snapshot',
        scope: 'provider',
      },
    ],
    structuredResponse: {
      intent:
        overrides.structuredResponse?.intent ?? 'scheduling.findBestMember',
      type: overrides.structuredResponse?.type ?? 'actionProposals',
      confidence: overrides.structuredResponse?.confidence ?? 'high',
      answer: overrides.structuredResponse?.answer ?? {
        summary: 'Field Tech is available.',
      },
      recommendations: overrides.structuredResponse?.recommendations,
      actionProposals: overrides.structuredResponse?.actionProposals ?? [
        {
          id: 'proposal-1',
          actionType: 'assignTechnician',
          label: 'Assign Field Tech',
          targetProviderId: 'scheduling',
          confidence: 'high',
          references: [],
        },
      ],
      warnings: overrides.structuredResponse?.warnings,
      citations: overrides.structuredResponse?.citations,
      followUpSuggestions: overrides.structuredResponse
        ?.followUpSuggestions ?? ['Review the technician schedule.'],
    },
    recommendedActions: [
      {
        id: 'proposal-1',
        actionType: 'assignTechnician',
        label: 'Assign Field Tech',
        targetProviderId: 'scheduling',
        confidence: 'high',
        references: [],
      },
    ],
    warnings: [],
    citations: [],
    followUpSuggestions: ['Review the technician schedule.'],
    executionRequests: [],
    prompt: {
      intent: 'scheduling.findBestMember',
      systemContext: {
        runtime: 'WorkspaceAIRuntime',
        version: 'foundation',
        executionBoundary: 'propose-only',
      },
      workspaceContext: {
        workspace,
        actor,
        language: 'en',
        enabledModules: ['scheduling'],
        availableProviders: [],
        capabilities: [],
        systemHealth: { status: 'ready', warnings: [] },
      },
      workspaceState: {
        workspaceId,
        createdAt: now.toISOString(),
        contextReferenceIds: [],
        snapshotReferenceIds: [],
        note: 'deterministic-workspace-state',
      },
      reasoningSnapshot: {} as any,
      knowledgeReferences: [],
      toolMetadata: [],
      requestedOutput: {
        type: 'actionProposals',
        capabilities: [],
      },
      constraints: [],
    },
    aiRequest: {
      id: 'ai-request:user-request-1',
      intent: 'scheduling.findBestMember',
      prompt: {} as AIRuntimeResponse['aiRequest']['prompt'],
      outputSchema: {
        type: 'actionProposals',
        requiredFields: ['intent', 'type', 'confidence'],
        supportsActionProposals: true,
        supportsToolRequests: true,
      },
      allowedTools: [],
      knowledgeProviderMetadata: [],
    },
    reasoningSnapshot: {} as any,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      rejectedActionProposals: [],
    },
    providerOutcome: 'generated',
    events: [
      {
        id: 'runtime-event:user-request-1:ResponseCompleted',
        type: 'ResponseCompleted',
        requestId: 'workspace-ai-runtime:user-request-1',
        createdAt: now.toISOString(),
        metadata: { valid: true },
      },
    ],
    ...overrides,
  }
}

describe('Workspace AI Experience Foundation', () => {
  it('creates a session without conversation memory or persistence', () => {
    const created = session()

    expect(created).toMatchObject({
      id: 'session-1',
      entryPointId: 'scheduling',
      currentIntent: 'scheduling.findBestMember',
      currentRuntimeState: { status: 'idle' },
    })
    expect(created.permissions).toEqual(['scheduling:read', 'workspace:read'])
    expect(created.currentContext.map((reference) => reference.id)).toEqual([
      'event:owner-busy',
    ])
    expect(created).not.toHaveProperty('messages')
  })

  it('registers entry points with stable capabilities, tools, providers, and permissions', () => {
    const scheduling = workspaceAIEntryPointRegistry.get('scheduling')
    const workflow = workspaceAIEntryPointRegistry.get('workflowBuilder')

    expect(scheduling?.supportedIntents).toContain('scheduling.findBestMember')
    expect(scheduling?.defaultProviderPriorities).toEqual(['scheduling'])
    expect(scheduling?.permissionRequirements).toEqual([
      'workspace:read',
      'scheduling:read',
    ])
    expect(workflow?.supportedIntents).toContain('workflow.explain')
    expect(workflow?.defaultProviderPriorities).toEqual([])
  })

  it('registers governed workspace investigation on the workspace entry point', () => {
    expect(
      workspaceAIEntryPointRegistry.supportsIntent(
        'workspace',
        'workspace.investigateQuestion',
      ),
    ).toBe(true)
    expect(
      workspaceAIEntryPointRegistry.supportsIntent(
        'workspace',
        'scheduling.findBestMember',
      ),
    ).toBe(false)
  })

  it('grounds broad workspace investigations to relevant deterministic providers', () => {
    const workspaceEntryPoint = workspaceAIEntryPointRegistry.get('workspace')
    if (!workspaceEntryPoint) throw new Error('workspace entry point missing')
    const workspaceSession = createWorkspaceAISession({
      id: 'workspace-session',
      workspace,
      actor,
      entryPointId: 'workspace',
      intent: 'workspace.investigateQuestion',
      now,
    })

    expect(
      toRuntimeRequest({
        request: userRequest({
          session: workspaceSession,
          requestText: 'Why are automations failing?',
          requestedIntent: 'workspace.investigateQuestion',
        }),
        entryPoint: workspaceEntryPoint,
        requestedIntent: 'workspace.investigateQuestion',
      }).requestedProviderIds,
    ).toEqual([])

    expect(
      toRuntimeRequest({
        request: userRequest({
          session: workspaceSession,
          requestText: 'Which leads should I work today?',
          requestedIntent: 'workspace.investigateQuestion',
        }),
        entryPoint: workspaceEntryPoint,
        requestedIntent: 'workspace.investigateQuestion',
      }).requestedProviderIds,
    ).toEqual(['crm'])
  })

  it('keeps future modules extensible through an injectable entry-point registry', () => {
    const registry = createWorkspaceAIEntryPointRegistry([
      {
        id: 'dashboard',
        label: 'Dashboard AI',
        supportedIntents: ['reports.explainMetric'],
        allowedCapabilities: ['supportsReporting'],
        allowedToolIds: ['workspace-intelligence.context.assemble'],
        defaultProviderPriorities: [],
        permissionRequirements: ['workspace:read'],
        defaultOutputType: 'analysis',
      },
    ])

    expect(registry.supportsIntent('dashboard', 'reports.explainMetric')).toBe(
      true,
    )
    expect(
      registry.supportsIntent('dashboard', 'scheduling.findBestMember'),
    ).toBe(false)
  })

  it('converts Workspace AI requests into runtime requests without raw prompts', () => {
    const entryPoint = workspaceAIEntryPointRegistry.get('scheduling')!
    const runtimeRequest = toRuntimeRequest({
      request: userRequest({
        requestedCapabilities: [
          'supportsSchedulingRecommendations',
          'supportsWorkflowGeneration',
        ],
        allowedToolIds: [
          'workspace-intelligence.recommendations.resolve',
          'not-entry-point-allowed',
        ],
        allowedActionTypes: ['assignTechnician'],
      }),
      entryPoint,
      requestedIntent: 'scheduling.findBestMember',
    })

    expect(runtimeRequest.executionMode).toBe('prepareOnly')
    expect(runtimeRequest.requestedProviderIds).toEqual(['scheduling'])
    expect(runtimeRequest.requestedCapabilities).toEqual([
      'supportsSchedulingRecommendations',
    ])
    expect(runtimeRequest.allowedToolIds).toEqual([
      'workspace-intelligence.recommendations.resolve',
    ])
    expect(runtimeRequest).not.toHaveProperty('prompt')
  })

  it('runs the request pipeline through WorkspaceAIRuntime only', async () => {
    const response = await runWorkspaceAIRequest({ request: userRequest() })

    expect(response.runtimeResponse.requestId).toBe(
      'workspace-ai-runtime:user-request-1',
    )
    expect(response.providerUsage.knowledgeProviderIds).toEqual(['scheduling'])
    expect(response.providerUsage.toolIds).toEqual([
      'workspace-intelligence.context.assemble',
      'workspace-intelligence.recommendations.resolve',
    ])
    expect(response.session.currentRuntimeState.status).toBe(
      'completedWithFallback',
    )
    expect(
      response.session.currentRuntimeState.lastRuntimeEventTypes,
    ).toContain('ResponseCompleted')
  })

  it('preserves permission-filtered provider references and avoids provider object duplication', async () => {
    const response = await runWorkspaceAIRequest({
      request: userRequest({
        session: createWorkspaceAISession({
          id: 'restricted-session',
          workspace,
          actor: {
            ...actor,
            role: 'MEMBER',
            workspaceMemberId: 'member-field',
            permissions: ['workspace:read', 'scheduling:read'],
          },
          entryPointId: 'scheduling',
          intent: 'scheduling.findBestMember',
          now,
        }),
        providerSources: {
          scheduling: schedulingSource({
            workspaceMemberId: 'member-field',
            role: 'MEMBER',
            visibleMemberIds: ['member-field'],
          }),
        },
      }),
    })

    expect(
      response.references.every((reference) => reference.source !== 'runtime'),
    ).toBe(true)
    expect(
      response.references.map((reference) => reference.providerId),
    ).toContain('scheduling')
    expect(response.runtimeResponse.prompt.workspaceContext).not.toHaveProperty(
      'events',
    )
  })

  it('maps runtime action proposals to suggested actions with pending approvals', () => {
    const response = toWorkspaceAIResponse({
      request: userRequest(),
      entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
      runtimeResponse: runtimeResponse(),
      requestedIntent: 'scheduling.findBestMember',
      warnings: [],
    })

    expect(response.suggestedActions).toEqual([
      expect.objectContaining({
        id: 'proposal-1',
        executionBoundary: 'proposal-only',
        approval: expect.objectContaining({
          id: 'approval:proposal-1',
          status: 'pending',
        }),
      }),
    ])
    expect(response.approvals.map((approval) => approval.status)).toEqual([
      'pending',
    ])
    expect(response.operationalIntelligence).toMatchObject({
      workspaceId,
      responseId: 'workspace-ai-response:user-request-1',
      deterministic: true,
      proposalOnly: true,
      audit: {
        executedActions: 0,
        knowledgeMutations: 0,
        approvalsCreated: 0,
      },
    })
    expect(
      response.operationalIntelligence.decisionExplanations.map(
        (explanation) => explanation.recommendationId,
      ),
    ).toContain('proposal-1')
  })

  it('normalizes sparse scheduling proposal responses without requiring optional arrays', () => {
    const response = toWorkspaceAIResponse({
      request: userRequest(),
      entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
      runtimeResponse: {
        requestId: 'runtime:sparse-scheduling',
        intent: 'scheduling.findBestMember',
        confidence: 'high',
        providerUsage: { knowledgeProviderIds: ['scheduling'] },
        toolUsage: {
          eligibleToolIds: [],
          requestedToolIds: [],
          executedToolIds: [],
        },
        structuredResponse: {
          intent: 'scheduling.findBestMember',
          type: 'actionProposals',
          confidence: 'high',
          recommendations: [
            {
              id: 'recommendation:sparse',
              providerId: 'scheduling',
              intent: 'scheduling.findBestMember',
              subject: { id: 'member-owner', type: 'member', label: 'Owner' },
              score: 90,
              confidence: 'high',
              reasons: [],
            },
          ],
        },
        validation: { valid: true },
        providerOutcome: 'generated',
        reasoningSnapshot: {},
      } as any,
      requestedIntent: 'scheduling.findBestMember',
      warnings: [],
    })

    expect(response.recommendations).toHaveLength(1)
    expect(response.suggestedActions).toEqual([])
    expect(response.followUpSuggestions).toEqual([])
    expect(response.runtimeResponse.events).toEqual([])
    expect(response.normalization?.repaired).toBe(true)
    expect(response.normalization?.developerNotice).toContain(
      'Workspace AI response normalized',
    )
  })

  it.each([
    {
      label: 'CRM lead prioritization',
      entryPointId: 'crm' as const,
      intent: 'crm.prioritizeLeads' as const,
      outputType: 'recommendations',
      providerId: 'crm',
    },
    {
      label: 'workspace investigation',
      entryPointId: 'workspace' as const,
      intent: 'workspace.investigateQuestion' as const,
      outputType: 'analysis',
      providerId: 'scheduling',
    },
  ])(
    'renders $label responses without scheduling-specific fields',
    ({ entryPointId, intent, outputType, providerId }) => {
      const domainSession = createWorkspaceAISession({
        id: `session:${entryPointId}`,
        workspace,
        actor,
        entryPointId,
        intent,
        now,
      })

      const response = toWorkspaceAIResponse({
        request: userRequest({
          session: domainSession,
          providerSources: {},
        }),
        entryPoint: workspaceAIEntryPointRegistry.get(entryPointId)!,
        runtimeResponse: {
          requestId: `runtime:${entryPointId}`,
          intent,
          providerUsage: { knowledgeProviderIds: [providerId] },
          structuredResponse: {
            intent,
            type: outputType,
            answer: { summary: `${entryPointId} completed.` },
          },
          validation: { valid: true },
          providerOutcome: 'generated',
        } as any,
        requestedIntent: intent,
        warnings: [],
      })

      expect(response.intent).toBe(intent)
      expect(response.responseType).toBe(outputType)
      expect(response.answer?.summary).toBe(`${entryPointId} completed.`)
      expect(response.warnings).toEqual([])
      expect(response.suggestedActions).toEqual([])
      expect(response.providerUsage.knowledgeProviderIds).toEqual([providerId])
      expect(response.normalization?.repaired).toBe(true)
    },
  )

  it.each([
    'providerTimeout',
    'providerUnavailable',
    'validationFallback',
    'deterministicFallback',
    'clarification',
    'partial',
    'failed',
  ] as const)(
    'normalizes %s runtime responses to safe renderable defaults',
    (providerOutcome) => {
      const response = toWorkspaceAIResponse({
        request: userRequest(),
        entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
        runtimeResponse: {
          requestId: `runtime:${providerOutcome}`,
          intent: 'scheduling.findBestMember',
          structuredResponse: {
            intent: 'scheduling.findBestMember',
            type: 'answer',
          },
          providerUsage: {},
          toolUsage: {},
          validation: {},
          providerOutcome,
        } as any,
        requestedIntent: 'scheduling.findBestMember',
        warnings: [],
      })

      expect(response.runtimeResponse.providerOutcome).toBe(providerOutcome)
      expect(response.recommendations).toEqual([])
      expect(response.suggestedActions).toEqual([])
      expect(
        response.session.currentRuntimeState.lastRuntimeEventTypes,
      ).toEqual([])
      expect(response.normalization?.repairCount).toBeGreaterThan(0)
    },
  )

  it('falls back to unknown/default enum values for malformed provider output', () => {
    const response = toWorkspaceAIResponse({
      request: userRequest(),
      entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
      runtimeResponse: {
        requestId: 'runtime:malformed-provider-output',
        intent: 42,
        confidence: 'extreme',
        providerUsage: { knowledgeProviderIds: 'scheduling' },
        toolUsage: { eligibleToolIds: 'tool' },
        structuredResponse: {
          type: 'not-a-runtime-output',
          confidence: 'certain',
          warnings: { message: 'not an array' },
          recommendations: { id: 'not an array' },
        },
        validation: { valid: 'yes', rejectedActionProposals: { id: 'nope' } },
        providerOutcome: 'surprise',
        events: { type: 'ResponseCompleted' },
      } as any,
      requestedIntent: 'scheduling.findBestMember',
      warnings: [],
    })

    expect(response.intent).toBe('scheduling.findBestMember')
    expect(response.responseType).toBe('answer')
    expect(response.confidence).toBe('unknown')
    expect(response.runtimeResponse.providerOutcome).toBe(
      'deterministicFallback',
    )
    expect(response.runtimeResponse.validation.valid).toBe(false)
    expect(response.recommendations).toEqual([])
    expect(response.runtimeResponse.events).toEqual([])
    expect(response.normalization?.developerNotice).toContain(
      'Workspace AI response normalized',
    )
  })

  it.each([
    ['subject undefined', { subject: undefined }],
    ['subject null', { subject: null }],
    ['subject empty object', { subject: {} }],
    ['subject string', { subject: 'Owner' }],
    [
      'subject missing label',
      { subject: { id: 'member-owner', type: 'member' } },
    ],
    ['empty recommendation', {}],
    [
      'missing reasons',
      { subject: { id: 'member-owner', type: 'member', label: 'Owner' } },
    ],
    [
      'missing references',
      {
        subject: { id: 'member-owner', type: 'member', label: 'Owner' },
        reasons: [],
      },
    ],
    [
      'missing title',
      {
        subject: { id: 'member-owner', type: 'member', label: 'Owner' },
        summary: 'Use owner.',
      },
    ],
    [
      'malformed confidence',
      {
        subject: { id: 'member-owner', type: 'member', label: 'Owner' },
        confidence: 'certain',
      },
    ],
    [
      'malformed priority',
      {
        subject: { id: 'member-owner', type: 'member', label: 'Owner' },
        priority: 'urgent',
      },
    ],
    [
      'CRM recommendation without entity',
      {
        providerId: 'crm',
        intent: 'crm.prioritizeLeads',
        title: 'Work CRM list',
      },
    ],
    [
      'Scheduling recommendation without selected event',
      { providerId: 'scheduling', title: 'Review dispatch load' },
    ],
    [
      'Workspace recommendation without a single target',
      { intent: 'workspace.investigateQuestion', title: 'Review bottleneck' },
    ],
    [
      'provider timeout fallback recommendation',
      { providerOutcome: 'providerTimeout', title: 'Provider fallback' },
    ],
    [
      'deterministic-only recommendation',
      {
        metadata: { deterministic: true },
        title: 'Deterministic recommendation',
      },
    ],
  ])('normalizes malformed recommendation variant: %s', (_label, partial) => {
    const result = normalizeWorkspaceRecommendations({
      recommendations: [
        {
          id: 'recommendation:variant',
          providerId: 'scheduling',
          intent: 'scheduling.findBestMember',
          score: 77,
          ...partial,
        },
      ],
      requestId: 'runtime:variant',
      producer: 'test-producer',
      fallbackIntent: 'scheduling.findBestMember',
      fallbackProviderId: 'scheduling',
    })

    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]).toMatchObject({
      id: 'recommendation:variant',
      subject: {
        label: expect.any(String),
        authoritative: expect.any(Boolean),
      },
      reasons: expect.any(Array),
      warnings: expect.any(Array),
      references: expect.any(Array),
      evidence: expect.any(Array),
      dependencies: expect.any(Array),
      confidence: expect.any(String),
      priority: expect.any(String),
      title: expect.any(String),
      summary: expect.any(String),
    })
    expect(result.recommendations[0].subject.label.length).toBeGreaterThan(0)
    expect(result.diagnostics[0]?.requestId).toBe('runtime:variant')
  })

  it.each([
    {
      domain: 'scheduling focus',
      entryPointId: 'scheduling' as const,
      intent: 'scheduling.balanceWorkload' as const,
      prompt: 'What should I focus on today',
    },
    {
      domain: 'scheduling selected event',
      entryPointId: 'scheduling' as const,
      intent: 'scheduling.findBestMember' as const,
      prompt: 'Recommend technician with selected event',
    },
    {
      domain: 'scheduling proposal',
      entryPointId: 'scheduling' as const,
      intent: 'scheduling.balanceWorkload' as const,
      prompt: 'Summarize workload with proposal',
    },
    {
      domain: 'emergency scheduling',
      entryPointId: 'scheduling' as const,
      intent: 'scheduling.findAvailableSlot' as const,
      prompt: 'Schedule emergency service',
    },
    {
      domain: 'crm lead focus',
      entryPointId: 'crm' as const,
      intent: 'crm.prioritizeLeads' as const,
      prompt: 'Which leads should I work today',
    },
    {
      domain: 'crm follow-ups',
      entryPointId: 'crm' as const,
      intent: 'crm.analyzeFollowUps' as const,
      prompt: 'Prioritize follow-ups',
    },
    {
      domain: 'crm opportunity risk',
      entryPointId: 'crm' as const,
      intent: 'crm.analyzeOpportunities' as const,
      prompt: 'Explain opportunity risk',
    },
    {
      domain: 'crm close likelihood',
      entryPointId: 'crm' as const,
      intent: 'crm.analyzeOpportunities' as const,
      prompt: 'Which opportunities are likely to close',
    },
    {
      domain: 'workspace focus',
      entryPointId: 'workspace' as const,
      intent: 'workspace.investigateQuestion' as const,
      prompt: 'What should I focus on today',
    },
    {
      domain: 'workspace automation failures',
      entryPointId: 'workspace' as const,
      intent: 'workspace.investigateQuestion' as const,
      prompt: 'Why are automations failing',
    },
    {
      domain: 'workspace service request risk',
      entryPointId: 'workspace' as const,
      intent: 'workspace.investigateQuestion' as const,
      prompt: 'Which service requests are most at risk',
    },
  ])(
    'completes $domain recommendation assembly with display-only subject fallback',
    ({ entryPointId, intent, prompt }) => {
      const domainSession = createWorkspaceAISession({
        id: `session:${entryPointId}:${prompt}`,
        workspace,
        actor,
        entryPointId,
        intent,
        now,
      })

      const response = toWorkspaceAIResponse({
        request: userRequest({
          id: `request:${entryPointId}:${prompt}`,
          session: domainSession,
          requestText: prompt,
        }),
        entryPoint: workspaceAIEntryPointRegistry.get(entryPointId)!,
        runtimeResponse: {
          ...runtimeResponse(),
          requestId: `runtime:${entryPointId}:${prompt}`,
          intent,
          structuredResponse: {
            intent,
            type: 'recommendations',
            confidence: 'high',
            recommendations: [
              {
                id: `recommendation:${prompt}`,
                providerId: entryPointId,
                intent,
                score: 90,
                confidence: 'high',
                reasons: [],
                references: [],
              },
            ],
          },
          recommendedActions: [],
        } as any,
        requestedIntent: intent,
        warnings: [],
      })

      expect(response.session.currentRuntimeState.status).toBe('completed')
      expect(response.recommendations).toHaveLength(1)
      expect(response.recommendations[0].subject).toMatchObject({
        label: expect.any(String),
        authoritative: false,
      })
      expect(response.recommendations[0].subject.id).toBeUndefined()
      expect(
        response.operationalIntelligence.decisionExplanations,
      ).toHaveLength(1)
      expect(response.suggestedActions).toEqual([])
      expect(
        response.recommendationNormalization?.diagnostics[0],
      ).toMatchObject({
        recommendationId: `recommendation:${prompt}`,
        subjectAuthority: 'display-only',
        defaultedFields: expect.arrayContaining(['subject.display']),
      })
    },
  )

  it('reports buildReferences when malformed knowledge references break reference sorting', () => {
    let thrown: unknown
    try {
      toWorkspaceAIResponse({
        request: {
          ...userRequest({ id: 'request:malformed-reference' }),
          session: {
            ...session(),
            currentContext: [undefined],
          },
        } as any,
        entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
        runtimeResponse: {
          ...runtimeResponse(),
          requestId: 'runtime:malformed-reference',
          structuredResponse: {
            intent: 'scheduling.findBestMember',
            type: 'answer',
            confidence: 'high',
            answer: { summary: 'Reference failure.' },
          },
          recommendedActions: [],
        } as any,
        requestedIntent: 'scheduling.findBestMember',
        warnings: [],
      })
    } catch (error) {
      thrown = error
    }

    expect(isWorkspaceAIExperienceAssemblyError(thrown)).toBe(true)
    if (!isWorkspaceAIExperienceAssemblyError(thrown)) {
      throw new Error('Expected WorkspaceAIExperienceAssemblyError')
    }
    expect(thrown.diagnostic.builder).toBe('buildReferences')
    expect(thrown.diagnostic.missingProperty).toBe('id')
    expect(thrown.diagnostic.file).toContain('workspaceAIExperience.ts')
    expect(thrown.diagnostic.objectKeys).toEqual([
      'contextReferences',
      'runtimeKnowledgeReferences',
    ])
  })

  it('defines approval status without executing approvals', () => {
    const approval = createWorkspaceAIApproval({
      actionProposalId: 'proposal-99',
      requiredPermission: 'scheduling:write',
      status: 'deferred',
    })

    expect(approval).toEqual({
      id: 'approval:proposal-99',
      status: 'deferred',
      actionProposalId: 'proposal-99',
      requiredPermission: 'scheduling:write',
    })
  })

  it('returns rendering metadata instead of React components', () => {
    const rendering = getWorkspaceAIResponseRendering({
      responseType: 'actionProposals',
      warnings: [
        {
          code: 'needs-review',
          message: 'Needs review.',
          severity: 'warning',
        },
      ],
      suggestedActions: [
        {
          id: 'proposal-1',
          actionType: 'assignTechnician',
          label: 'Assign technician',
          confidence: 'high',
          references: [],
          approval: createWorkspaceAIApproval({
            actionProposalId: 'proposal-1',
          }),
          executionBoundary: 'proposal-only',
        },
      ],
      references: [
        {
          id: 'reference-1',
          label: 'Scheduling snapshot',
          source: 'workspace-intelligence',
        },
      ],
    })

    expect(rendering).toMatchObject({
      responseType: 'actionProposals',
      severity: 'warning',
      recommendedLayout: 'action-review',
      expandableSections: ['warnings', 'references', 'actions', 'details'],
    })
  })

  it('keeps context awareness as references instead of copying large objects', () => {
    const response = toWorkspaceAIResponse({
      request: userRequest({
        contextReferences: [workflowContext],
      }),
      entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
      runtimeResponse: runtimeResponse(),
      requestedIntent: 'scheduling.findBestMember',
      warnings: [],
    })

    expect(response.references.map((reference) => reference.id)).toEqual(
      expect.arrayContaining([
        'workspace-ai-reference:context:event:owner-busy',
        'workspace-ai-reference:context:workflow:workflow-1',
        'workspace-ai-reference:knowledge:reference:scheduling:snapshot:1',
      ]),
    )
    expect(
      response.references.find(
        (reference) => reference.contextReference?.id === 'workflow:workflow-1',
      )?.contextReference?.metadata,
    ).toEqual({ workflowId: 'workflow-1' })
  })

  it('models conversation interfaces without storage or chat UI behavior', () => {
    const created = createWorkspaceAISession({
      id: 'conversation-session',
      workspace,
      actor,
      entryPointId: 'workspace',
      conversation: {
        conversationId: 'conversation-1',
        turnId: 'turn-1',
        source: 'workspace',
      },
      now,
    })

    expect(created.conversation).toEqual({
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      source: 'workspace',
    })
  })

  it('is deterministic for identical session and response inputs', () => {
    const first = toWorkspaceAIResponse({
      request: userRequest(),
      entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
      runtimeResponse: runtimeResponse(),
      requestedIntent: 'scheduling.findBestMember',
      warnings: [],
    })
    const second = toWorkspaceAIResponse({
      request: userRequest(),
      entryPoint: workspaceAIEntryPointRegistry.get('scheduling')!,
      runtimeResponse: runtimeResponse(),
      requestedIntent: 'scheduling.findBestMember',
      warnings: [],
    })

    expect(first.references).toEqual(second.references)
    expect(first.rendering).toEqual(second.rendering)
    expect(first.providerUsage).toEqual(second.providerUsage)
    expect(first.operationalIntelligence).toEqual(
      second.operationalIntelligence,
    )
  })

  it('exposes a single experience factory over the runtime and entry-point registry', () => {
    const experience = createWorkspaceAIExperience()

    expect(experience.entryPointRegistry.get('scheduling')?.id).toBe(
      'scheduling',
    )
    expect(experience.runtimeRegistry.getAIProvider()).toBeNull()
    expect(experience.createSession).toBe(createWorkspaceAISession)
    expect(experience.runRequest).toBe(runWorkspaceAIRequest)
  })

  it('can be tested with a runtime stub without bypassing the runtime contract', async () => {
    class StubRuntime extends WorkspaceAIRuntime {
      override async run(): Promise<AIRuntimeResponse> {
        return runtimeResponse({
          structuredResponse: {
            intent: 'scheduling.findBestMember',
            type: 'answer',
            confidence: 'high',
            answer: { summary: 'Stubbed runtime answer.' },
          },
          recommendedActions: [],
        })
      }
    }

    const response = await runWorkspaceAIRequest({
      request: userRequest({ requestedOutputType: 'answer' }),
      runtime: new StubRuntime(),
    })

    expect(response.answer?.summary).toBe('Stubbed runtime answer.')
    expect(response.runtimeResponse.requestId).toBe(
      'workspace-ai-runtime:user-request-1',
    )
  })
})

import { describe, expect, it } from 'vitest'

import { buildWorkspaceReasoningSnapshot } from '@/lib/ai/reasoning/workspaceReasoningEngine'
import type {
  KnowledgeProviderMetadata,
  WorkspaceContextAssemblerResult,
  WorkspaceToolMetadata,
} from '@/lib/intelligence/workspaceIntelligence'

const createdAt = '2026-08-04T12:00:00.000Z'

const schedulingProvider: KnowledgeProviderMetadata = {
  id: 'scheduling',
  label: 'Scheduling Knowledge',
  domain: 'scheduling',
  supportedIntents: ['workspace.investigateQuestion'],
  capabilities: [],
  permissionBoundary: {
    strategy: 'provider-filtered',
    description: 'Scheduling is filtered by workspace permissions.',
    requiredPermissions: ['scheduling:read'],
  },
  sourceAvailability: 'source-required',
  description: 'Scheduling evidence.',
}

const crmProvider: KnowledgeProviderMetadata = {
  id: 'crm',
  label: 'CRM Knowledge',
  domain: 'crm',
  supportedIntents: ['workspace.investigateQuestion'],
  capabilities: [],
  permissionBoundary: {
    strategy: 'provider-filtered',
    description: 'CRM is filtered by workspace permissions.',
    requiredPermissions: ['crm:read'],
  },
  sourceAvailability: 'source-required',
  description: 'CRM evidence.',
}

const selectedTools: WorkspaceToolMetadata[] = [
  {
    id: 'workspace-intelligence.context.assemble',
    label: 'Assemble workspace context',
    supportedIntents: ['workspace.investigateQuestion'],
    requiredCapabilities: ['supportsContext'],
    requiredPermissions: ['workspace:read'],
    supportedProviderIds: ['scheduling'],
    executes: false,
  },
]

function assembledContext(
  overrides: Partial<WorkspaceContextAssemblerResult> = {},
): WorkspaceContextAssemblerResult {
  return {
    intent: 'workspace.investigateQuestion',
    context: {
      workspace: {
        id: 'workspace-1',
        timezone: 'America/New_York',
      },
      actor: {
        userId: 'user-1',
        workspaceMemberId: 'member-1',
        permissions: ['workspace:read', 'scheduling:read'],
      },
      language: 'en',
      enabledModules: ['scheduling', 'crm'],
      availableProviders: [schedulingProvider],
      capabilities: [],
      systemHealth: {
        status: 'ready',
        warnings: [],
      },
    },
    providerContexts: [
      {
        providerId: 'scheduling',
        domain: 'scheduling',
        context: { eventCount: 2 },
        reference: {
          id: 'reference:scheduling:context',
          providerId: 'scheduling',
          domain: 'scheduling',
          kind: 'context',
          label: 'Scheduling context',
          scope: 'provider',
          createdAt,
        },
      },
    ],
    providerSnapshots: [
      {
        providerId: 'scheduling',
        domain: 'scheduling',
        snapshot: { conflicts: 1 },
        reference: {
          id: 'reference:scheduling:snapshot',
          providerId: 'scheduling',
          domain: 'scheduling',
          kind: 'snapshot',
          label: 'Scheduling snapshot',
          scope: 'provider',
          createdAt,
        },
      },
    ],
    references: [
      {
        id: 'reference:scheduling:snapshot',
        providerId: 'scheduling',
        domain: 'scheduling',
        kind: 'snapshot',
        label: 'Scheduling snapshot',
        scope: 'provider',
        createdAt,
      },
    ],
    state: {
      workspaceId: 'workspace-1',
      createdAt,
      contextReferenceIds: ['reference:scheduling:context'],
      snapshotReferenceIds: ['reference:scheduling:snapshot'],
      note: 'deterministic-workspace-state',
    },
    warnings: [],
    fingerprint: 'fingerprint-1',
    ...overrides,
  }
}

describe('Workspace Reasoning Engine', () => {
  it('creates the complete deterministic reasoning package before an LLM is called', () => {
    const snapshot = buildWorkspaceReasoningSnapshot({
      requestId: 'request-1',
      intent: 'workspace.investigateQuestion',
      outputType: 'analysis',
      assembled: assembledContext(),
      selectedTools,
      selectedProviderMetadata: [schedulingProvider],
      constraints: ['User request: Why are automations failing?'],
      now: new Date(createdAt),
    })

    expect(snapshot.immutable).toBe(true)
    expect(snapshot.investigationGoal).toContain('Why are automations failing?')
    expect(snapshot.investigationPlan[0]).toMatchObject({
      title:
        'Review Scheduling Knowledge evidence for workspace.investigateQuestion.',
      providerIds: ['scheduling'],
      status: 'ready',
    })
    expect(snapshot.evidence.every((item) => item.verified)).toBe(true)
    expect(snapshot.evidenceGroups.map((group) => group.domain)).toContain(
      'scheduling',
    )
    expect(snapshot.reasoningChain.length).toBeGreaterThan(0)
    expect(snapshot.coverageReport.inspectedDomains).toEqual(['scheduling'])
    expect(snapshot.confidenceReport.overall).toBe('high')
    expect(snapshot.providerInstructions).toContain('Never invent facts.')
  })

  it('identifies missing information and lowers confidence without fabricating facts', () => {
    const snapshot = buildWorkspaceReasoningSnapshot({
      requestId: 'request-2',
      intent: 'workspace.investigateQuestion',
      outputType: 'analysis',
      assembled: assembledContext({
        context: {
          ...assembledContext().context,
          availableProviders: [schedulingProvider, crmProvider],
        },
        warnings: ['CRM source data was not available.'],
      }),
      selectedTools,
      selectedProviderMetadata: [schedulingProvider, crmProvider],
      missingRequestedProviderIds: ['commerce' as never],
      governedKnowledge: {
        approvedKnowledge: [],
        knowledgeGaps: [{ title: 'Google Ads CPA is not connected.' }],
        correctionsMetadata: [],
        recommendationHistory: [],
      },
      now: new Date(createdAt),
    })

    expect(snapshot.missingInformation.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'CRM source data was not available.',
        'Knowledge provider commerce is not registered.',
        'CRM Knowledge source data was not available.',
        'Google Ads CPA is not connected.',
      ]),
    )
    expect(snapshot.coverageReport.couldNotInspect).toEqual([
      {
        providerId: 'commerce',
        reason: 'Provider is not registered in the runtime registry.',
      },
    ])
    expect(snapshot.confidenceReport.score).toBeLessThan(80)
    expect(snapshot.rootCauseRanking[0]?.score).toBeGreaterThan(0)
  })

  it('extracts approved business rules and governed learning opportunities only as recommendations', () => {
    const snapshot = buildWorkspaceReasoningSnapshot({
      requestId: 'request-3',
      intent: 'workspace.investigateQuestion',
      outputType: 'actionProposals',
      assembled: assembledContext(),
      selectedTools,
      selectedProviderMetadata: [schedulingProvider],
      allowedActionTypes: ['createTask', 'createTask'],
      governedKnowledge: {
        approvedKnowledge: [
          {
            title: 'Manager approval is required before schedule changes.',
          },
        ],
        knowledgeGaps: [],
        correctionsMetadata: [],
        recommendationHistory: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
      },
      now: new Date(createdAt),
    })

    expect(snapshot.businessRulesApplied).toEqual([
      {
        id: 'business-rule:1',
        rule: 'Manager approval is required before schedule changes.',
        source: 'Approved Workspace Knowledge',
        confidence: 'high',
      },
    ])
    expect(snapshot.proposalCandidates).toHaveLength(1)
    expect(snapshot.proposalCandidates[0]).toMatchObject({
      id: 'proposal-candidate:createTask',
      title: 'Prepare Create Task proposal',
      requiredApprovals: ['Workspace approval policy'],
    })
    expect(snapshot.learningOpportunities).toEqual([
      {
        id: 'learning:recurring-recommendation-history',
        title:
          'Review recurring recommendation patterns as governed workspace knowledge.',
        reason:
          'Repeated recommendation history can indicate a stable owner preference or operating rule.',
        sourcePattern: 'recommendationHistory',
        approvalRequired: true,
      },
    ])
  })
})

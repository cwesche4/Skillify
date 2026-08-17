import { describe, expect, it } from 'vitest'

import {
  assembleContext,
  createKnowledgeProviderRegistry,
  crmKnowledgeProvider,
  resolveExplanation,
  resolveIntent,
  resolveKnowledge,
  resolveRecommendations,
  resolveSnapshot,
  schedulingKnowledgeProvider,
  workspaceIntelligenceToolRegistry,
  workspaceKnowledgeProviderRegistry,
  type WorkspaceIntelligenceActor,
  type WorkspaceIntelligenceWorkspace,
} from '@/lib/intelligence/workspaceIntelligence'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type { SchedulingKnowledgeInput } from '@/lib/scheduling/schedulingKnowledge'
import type { CRMKnowledgeSource } from '@/lib/crm/knowledge'
import type {
  SchedulingEvent,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

const now = new Date('2026-07-30T14:00:00.000Z')
const workspaceId = 'workspace-intelligence'

const settings = normalizeSchedulingSettings({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  workspaceTimezone: 'America/New_York',
  settings: {
    timezone: 'America/New_York',
  },
})

const capabilities = getWorkspaceSchedulingCapabilities({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  settings,
  workspaceTimezone: 'America/New_York',
})

const workspace: WorkspaceIntelligenceWorkspace = {
  id: workspaceId,
  slug: 'acme',
  name: 'Acme',
  timezone: 'America/New_York',
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  enabledModules: ['scheduling', 'workflow', 'crm'],
}

const owner: WorkspaceIntelligenceActor = {
  userId: 'user-owner',
  workspaceMemberId: 'member-owner',
  role: 'OWNER',
  permissions: ['crm:read', 'scheduling:read', 'workspace:read'],
  language: 'en',
}

const members = [
  {
    id: 'member-owner',
    label: 'Owner',
    role: 'OWNER',
    status: 'active',
    teamIds: ['team-office'],
    locationId: 'location-office',
  },
  {
    id: 'member-field',
    label: 'Field Tech',
    role: 'MEMBER',
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
    id: 'event-owner-busy',
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
    id: 'event-field-open',
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
    id: 'business-hours',
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
      slug: 'acme',
      name: 'Acme',
      timezone: 'America/New_York',
    },
    settings,
    capabilities,
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

function crmSource(): CRMKnowledgeSource {
  return {
    workspace: {
      id: workspaceId,
      slug: 'acme',
      name: 'Acme',
      timezone: 'America/New_York',
    },
    actor: {
      userId: owner.userId,
      workspaceMemberId: owner.workspaceMemberId,
      role: owner.role,
      permissions: owner.permissions,
    },
    now,
    leads: [
      {
        id: 'lead-riley',
        workspaceId,
        name: 'Riley Carter',
        company: 'Carter Plumbing',
        status: 'Contacted',
        stage: 'Contacted',
        source: 'Website Form',
        value: 8_000,
        ownerId: 'member-owner',
        createdAt: '2026-07-01',
        lastActivityAt: '2026-07-05',
        followUpDue: '2026-07-29',
        nextStep: 'Call about estimate',
        converted: false,
      },
    ],
    opportunities: [
      {
        id: 'opp-riley',
        workspaceId,
        name: 'Automation Package',
        client: 'Carter Plumbing',
        status: 'Active',
        stage: 'Proposal Sent',
        value: 12_000,
        probability: 50,
        ownerId: 'member-owner',
        nextStep: '',
        lastActivityAt: '2026-06-01',
        expectedCloseDate: '2026-07-20',
        sourceLeadId: 'lead-riley',
      },
    ],
    clients: [],
    tasks: [],
    followUps: [],
    activities: [],
    meetings: [],
  }
}

describe('workspace intelligence foundation', () => {
  it('registers concrete deterministic knowledge providers', () => {
    const metadata = workspaceKnowledgeProviderRegistry.getMetadata()

    expect(metadata.map((provider) => provider.id)).toEqual([
      'scheduling',
      'crm',
    ])
    expect(metadata[0]).toMatchObject({
      domain: 'scheduling',
      sourceAvailability: 'source-required',
      permissionBoundary: {
        strategy: 'provider-filtered',
      },
    })
    expect(
      workspaceKnowledgeProviderRegistry
        .getCapabilities()
        .map((capability) => capability.key),
    ).toEqual(
      expect.arrayContaining([
        'supportsSchedulingRecommendations',
        'supportsSchedulingAvailability',
        'supportsCRMRecommendations',
        'supportsKnowledgeReferences',
      ]),
    )
  })

  it('routes intents to the minimal matching provider set', () => {
    expect(
      resolveIntent({
        domain: 'scheduling',
        action: 'recommend-member',
      }),
    ).toBe('scheduling.findBestMember')
    expect(
      workspaceKnowledgeProviderRegistry
        .providersForIntent('scheduling.findBestMember')
        .map((provider) => provider.id),
    ).toEqual(['scheduling'])
    expect(
      workspaceKnowledgeProviderRegistry
        .providersForIntent('crm.explainRecord')
        .map((provider) => provider.id),
    ).toEqual(['crm'])
    expect(
      resolveIntent({
        domain: 'crm',
        action: 'prioritize-leads',
      }),
    ).toBe('crm.prioritizeLeads')
  })

  it('assembles deterministic workspace context without raw provider objects at the root', () => {
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })

    expect(assembled.context.workspace).toMatchObject({
      id: workspaceId,
      timezone: 'America/New_York',
    })
    expect(assembled.context.enabledModules).toEqual([
      'crm',
      'scheduling',
      'workflow',
    ])
    expect(assembled.providerContexts).toHaveLength(1)
    expect(assembled.providerSnapshots).toHaveLength(1)
    expect(assembled.context).not.toHaveProperty('events')
    expect(
      assembled.context.availableProviders.map((provider) => provider.id),
    ).toEqual(['scheduling', 'crm'])
    expect(assembled.state.note).toBe('deterministic-workspace-state')
  })

  it('lets providers enforce permission boundaries before assembler access', () => {
    const assembled = assembleContext({
      workspace,
      actor: {
        ...owner,
        role: 'MEMBER',
        workspaceMemberId: 'member-field',
        permissions: ['scheduling:read'],
      },
      requestedIntent: 'scheduling.findBestMember',
      providerSources: {
        scheduling: schedulingSource({
          workspaceMemberId: 'member-field',
          role: 'MEMBER',
          visibleMemberIds: ['member-field'],
        }),
      },
    })

    const schedulingContext = assembled.providerContexts[0]?.context as {
      members: { id: string }[]
      events: { id: string }[]
    }
    expect(schedulingContext.members.map((member) => member.id)).toEqual([
      'member-field',
    ])
    expect(schedulingContext.events.map((event) => event.id)).toEqual([
      'event-field-open',
    ])
  })

  it('returns structured warnings instead of expanding unrelated domains or sources', () => {
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'crm.explainRecord',
      providerSources: { scheduling: schedulingSource() },
    })

    expect(assembled.providerContexts).toEqual([])
    expect(assembled.providerSnapshots).toEqual([])
    expect(assembled.warnings).toEqual([
      'Provider crm was selected but no source data was supplied.',
    ])
  })

  it('assembles CRM snapshots and recommendations through the shared runtime contracts', () => {
    const assembled = assembleContext({
      workspace,
      actor: owner,
      requestedIntent: 'crm.prioritizeLeads',
      providerSources: { crm: crmSource() },
    })

    expect(assembled.providerContexts[0]).toMatchObject({
      providerId: 'crm',
      domain: 'crm',
    })
    expect(assembled.providerSnapshots[0]).toMatchObject({
      providerId: 'crm',
      domain: 'crm',
    })

    const recommendations = resolveRecommendations({
      workspace,
      actor: owner,
      requestedIntent: 'crm.prioritizeLeads',
      providerSources: { crm: crmSource() },
    })
    expect(recommendations[0]).toMatchObject({
      providerId: 'crm',
      intent: 'crm.prioritizeLeads',
      subject: {
        id: 'lead-riley',
        type: 'lead',
        label: 'Riley Carter',
      },
      metadata: {
        deterministic: true,
        scoreScale: '0-100',
      },
    })
    expect(
      recommendations.every((recommendation) => recommendation.score <= 100),
    ).toBe(true)

    const explanation = resolveExplanation({
      workspace,
      actor: owner,
      requestedIntent: 'crm.explainRecord',
      providerSources: { crm: crmSource() },
      recommendation: recommendations[0]!,
    })
    expect(explanation).toMatchObject({
      providerId: 'crm',
      intent: 'crm.explainRecord',
      subject: { id: 'lead-riley' },
      confidence: recommendations[0]?.confidence,
    })
  })

  it('resolves deterministic snapshots and knowledge references', () => {
    const first = resolveSnapshot({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })
    const second = resolveSnapshot({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
    })

    expect(first.providerSnapshots[0]?.providerId).toBe('scheduling')
    expect(first.references[0]).toMatchObject({
      providerId: 'scheduling',
      kind: 'snapshot',
      scope: 'provider',
    })
    expect(first.fingerprint).toBe(second.fingerprint)
  })

  it('resolves generic recommendations and explanations from provider output', () => {
    const recommendations = resolveRecommendations({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.findBestMember',
      providerSources: { scheduling: schedulingSource() },
      recommendationRequest: {
        rangeStart: new Date('2026-07-30T15:00:00.000Z'),
        rangeEnd: new Date('2026-07-30T16:00:00.000Z'),
        locationId: 'location-field',
      },
    })

    expect(recommendations[0]).toMatchObject({
      providerId: 'scheduling',
      intent: 'scheduling.findBestMember',
      subject: {
        id: 'member-field',
        type: 'member',
        label: 'Field Tech',
      },
    })
    expect(recommendations[0]?.references[0]).toMatchObject({
      kind: 'recommendation',
      providerId: 'scheduling',
    })

    const explanation = resolveExplanation({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.explainAssignment',
      providerSources: { scheduling: schedulingSource() },
      recommendation: recommendations[0]!,
    })
    expect(explanation).toMatchObject({
      providerId: 'scheduling',
      intent: 'scheduling.explainAssignment',
      subject: { id: 'member-field' },
      confidence: recommendations[0]?.confidence,
    })
    expect(explanation?.reasons.length).toBeGreaterThan(0)
  })

  it('keeps provider registry injectable for future modules without duplicating logic', () => {
    const registry = createKnowledgeProviderRegistry([
      schedulingKnowledgeProvider,
    ])
    const assembled = resolveKnowledge({
      workspace,
      actor: owner,
      requestedIntent: 'scheduling.balanceWorkload',
      providers: registry,
      providerSources: { scheduling: schedulingSource() },
    })

    expect(assembled.context.availableProviders).toHaveLength(1)
    expect(assembled.providerSnapshots[0]?.reference.fingerprint).toEqual(
      expect.any(String),
    )
  })

  it('publishes metadata for future tools without executing them', () => {
    expect(
      workspaceIntelligenceToolRegistry.every(
        (tool) => tool.executes === false,
      ),
    ).toBe(true)
    expect(workspaceIntelligenceToolRegistry[0]).toMatchObject({
      id: 'workspace-intelligence.context.assemble',
      supportedProviderIds: ['scheduling'],
    })
    expect(workspaceIntelligenceToolRegistry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-intelligence.crm-context.assemble',
          supportedProviderIds: ['crm'],
        }),
      ]),
    )
  })

  it('keeps CRM provider injectable without requiring scheduling sources', () => {
    const registry = createKnowledgeProviderRegistry([crmKnowledgeProvider])
    const assembled = resolveKnowledge({
      workspace,
      actor: owner,
      requestedIntent: 'crm.analyzePipeline',
      providers: registry,
      providerSources: { crm: crmSource() },
    })

    expect(assembled.context.availableProviders).toHaveLength(1)
    expect(assembled.context.availableProviders[0]?.id).toBe('crm')
    expect(assembled.providerSnapshots[0]?.providerId).toBe('crm')
  })
})

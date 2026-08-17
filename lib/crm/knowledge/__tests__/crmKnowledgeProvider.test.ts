import { describe, expect, it } from 'vitest'

import {
  buildCRMKnowledgeSource,
  getCRMKnowledgeRecommendations,
  getCRMKnowledgeSnapshot,
  type CRMKnowledgeSource,
} from '@/lib/crm/knowledge'

const workspaceId = 'workspace-crm'
const now = '2026-07-30T14:00:00.000Z'

function source(
  overrides: Partial<CRMKnowledgeSource> = {},
): CRMKnowledgeSource {
  return {
    workspace: {
      id: workspaceId,
      slug: 'acme',
      name: 'Acme',
      timezone: 'America/New_York',
    },
    actor: {
      userId: 'user-owner',
      workspaceMemberId: 'member-owner',
      role: 'OWNER',
      permissions: ['crm:read', 'workspace:read'],
    },
    now,
    leads: [
      {
        id: 'lead-overdue',
        workspaceId,
        name: 'Riley Carter',
        company: 'Carter Plumbing',
        contactEmail: 'riley@example.com',
        status: 'Contacted',
        stage: 'Contacted',
        source: 'Website Form',
        value: 6_500,
        ownerId: 'member-owner',
        createdAt: '2026-07-01',
        lastActivityAt: '2026-07-05',
        followUpDue: '2026-07-27',
        nextStep: 'Call about proposal',
        converted: false,
        provenance: 'authoritative',
      },
      {
        id: 'lead-qualified',
        workspaceId,
        name: 'Morgan Lane',
        company: 'Lane Wellness',
        status: 'Qualified',
        stage: 'Qualified',
        source: 'Referral',
        value: 4_000,
        createdAt: '2026-07-20',
        followUpDue: '2026-07-30',
        nextStep: '',
        converted: false,
      },
      {
        id: 'lead-converted',
        workspaceId,
        name: 'Converted Lead',
        company: 'Won Co.',
        status: 'Converted',
        stage: 'Converted',
        source: 'Google Search',
        value: 5_000,
        ownerId: 'member-owner',
        createdAt: '2026-07-01',
        followUpDue: '2026-07-01',
        converted: true,
      },
      {
        id: 'lead-other-workspace',
        workspaceId: 'other-workspace',
        name: 'Other Workspace',
        status: 'New',
        stage: 'New',
        value: 9_000,
        createdAt: '2026-07-01',
        converted: false,
      },
    ],
    followUps: [
      {
        id: 'follow-up-completed',
        workspaceId,
        leadId: 'lead-completed-follow-up',
        ownerId: 'member-owner',
        dueAt: '2026-07-25',
        completedAt: '2026-07-26',
        outcome: 'Reached contact',
      },
      {
        id: 'follow-up-no-response',
        workspaceId,
        leadId: 'lead-overdue',
        ownerId: 'member-owner',
        dueAt: '2026-07-29',
        outcome: 'No response',
      },
    ],
    opportunities: [
      {
        id: 'opp-stalled',
        workspaceId,
        name: 'Automation Package',
        client: 'NorthStar Electrical',
        status: 'Active',
        stage: 'Proposal Sent',
        value: 12_000,
        probability: 50,
        ownerId: 'member-owner',
        nextStep: '',
        lastActivityAt: '2026-06-01',
        expectedCloseDate: '2026-07-20',
        sourceLeadId: 'lead-overdue',
      },
      {
        id: 'opp-won',
        workspaceId,
        name: 'Closed Work',
        client: 'Won Co.',
        status: 'Closed-Won',
        stage: 'Won',
        value: 2_000,
        probability: 100,
        ownerId: 'member-owner',
      },
    ],
    clients: [
      {
        id: 'client-active',
        workspaceId,
        name: 'Jordan Reed',
        company: 'Reed Studio',
        email: '',
        phone: '',
        status: 'Active',
        health: 'Needs Attention',
        ownerId: '',
        createdAt: '2026-07-15',
        openTasks: 2,
        sourceLeadId: 'lead-overdue',
      },
    ],
    tasks: [
      {
        id: 'task-orphan',
        workspaceId,
        title: 'Follow orphan',
        status: 'Open',
        priority: 'High',
        relatedRecordType: 'lead',
        relatedRecordId: 'missing-lead',
        relatedRecordLabel: 'Missing Lead',
        dueDate: '2026-07-29',
      },
    ],
    activities: [
      {
        id: 'activity-recent',
        workspaceId,
        title: 'Lead note added',
        timestamp: '2026-07-29',
      },
    ],
    meetings: [
      {
        id: 'meeting-discovery',
        workspaceId,
        title: 'Discovery',
        startsAt: '2026-07-31T14:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

describe('CRM knowledge provider', () => {
  it('calculates workspace-scoped lead facts and deterministic recommendations', () => {
    const snapshot = getCRMKnowledgeSnapshot(source())

    expect(snapshot.workspaceId).toBe(workspaceId)
    expect(snapshot.leadFacts.total).toBe(3)
    expect(snapshot.leadFacts.active).toBe(2)
    expect(snapshot.leadFacts.converted).toBe(1)
    expect(snapshot.leadFacts.overdueFollowUps).toBe(1)
    expect(snapshot.leadFacts.dueTodayFollowUps).toBe(1)
    expect(snapshot.leadFacts.highValue).toBe(1)
    expect(snapshot.dataQuality).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'workspaceScope',
          recordId: 'lead-other-workspace',
        }),
        expect.objectContaining({
          category: 'inconsistentLifecycle',
          recordId: 'lead-converted',
        }),
      ]),
    )

    const leadRecommendations = snapshot.recommendations.filter(
      (recommendation) => recommendation.targetRecordType === 'lead',
    )
    expect(leadRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'crm.followUpLead',
          targetRecordId: 'lead-overdue',
          suggestedAction: expect.objectContaining({
            approvalRequired: true,
            executionStatus: 'notStarted',
          }),
        }),
        expect.objectContaining({
          type: 'crm.convertQualifiedLead',
          targetRecordId: 'lead-qualified',
        }),
      ]),
    )
    expect(snapshot.recommendations.every((item) => item.score <= 100)).toBe(
      true,
    )
    expect(snapshot.recommendations[0]?.score).toBeGreaterThanOrEqual(
      snapshot.recommendations.at(-1)?.score ?? 0,
    )
  })

  it('does not count a completed follow-up as active overdue work', () => {
    const snapshot = getCRMKnowledgeSnapshot(
      source({
        leads: [
          {
            id: 'lead-completed-follow-up',
            workspaceId,
            name: 'Completed Follow Up',
            status: 'Contacted',
            stage: 'Contacted',
            value: 1_000,
            ownerId: 'member-owner',
            createdAt: '2026-07-01',
            followUpDue: '2026-07-25',
            converted: false,
          },
        ],
      }),
    )

    expect(snapshot.leadFacts.overdueFollowUps).toBe(0)
    expect(snapshot.recommendations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'crm.followUpLead' }),
      ]),
    )
  })

  it('calculates opportunity pipeline facts, risks, and data quality', () => {
    const snapshot = getCRMKnowledgeSnapshot(source())

    expect(snapshot.opportunityFacts.open).toBe(1)
    expect(snapshot.opportunityFacts.won).toBe(1)
    expect(snapshot.opportunityFacts.pipelineValue).toBe(12_000)
    expect(snapshot.opportunityFacts.weightedExpectedRevenue).toBe(6_000)
    expect(snapshot.opportunityFacts.atRiskValue).toBe(12_000)
    expect(snapshot.pipelineFacts.topDeals[0]).toMatchObject({
      id: 'opp-stalled',
      value: 12_000,
    })
    expect(snapshot.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordType: 'opportunity',
          recordId: 'opp-stalled',
        }),
      ]),
    )
    expect(snapshot.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'crm.reviewStaleRecord',
          targetRecordId: 'opp-stalled',
        }),
        expect.objectContaining({
          type: 'crm.updateOpportunityCloseDate',
          targetRecordId: 'opp-stalled',
        }),
      ]),
    )
  })

  it('summarizes client context without inventing revenue facts', () => {
    const snapshot = getCRMKnowledgeSnapshot(source())

    expect(snapshot.clientFacts.total).toBe(1)
    expect(snapshot.clientFacts.missingOwner).toBe(1)
    expect(snapshot.clientFacts.missingContact).toBe(1)
    expect(snapshot.clientFacts.openTasks).toBe(2)
    expect(snapshot.dataQuality).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'dataLimitation',
          severity: 'info',
        }),
      ]),
    )
  })

  it('applies permission boundaries before exposing CRM counts or record IDs', () => {
    const snapshot = getCRMKnowledgeSnapshot(
      source({
        actor: {
          userId: 'user-member',
          workspaceMemberId: 'member-field',
          role: 'MEMBER',
          permissions: ['workspace:read'],
        },
      }),
    )

    expect(snapshot.leadFacts.total).toBe(0)
    expect(snapshot.references).toEqual([])
    expect(snapshot.dataQuality).toEqual([
      expect.objectContaining({
        category: 'permission',
        severity: 'blocking',
      }),
    ])
  })

  it('supports partial entity permissions', () => {
    const snapshot = getCRMKnowledgeSnapshot(
      source({
        actor: {
          userId: 'user-leads',
          workspaceMemberId: 'member-leads',
          role: 'MEMBER',
          permissions: ['leads:read'],
        },
      }),
    )

    expect(snapshot.leadFacts.total).toBe(3)
    expect(snapshot.opportunityFacts.total).toBe(0)
    expect(snapshot.clientFacts.total).toBe(0)
  })

  it('builds production source from repositories without importing preview fixtures', async () => {
    const built = await buildCRMKnowledgeSource({
      workspace: source().workspace,
      actor: source().actor,
      now,
      repositories: {
        listLeads: async () => [
          {
            id: 'lead-authoritative',
            workspaceId,
            name: 'Authoritative Lead',
            status: 'New',
            stage: 'New',
          },
        ],
      },
    })

    expect(built.leads).toHaveLength(1)
    expect(built.opportunities).toEqual([])
    expect(getCRMKnowledgeRecommendations(built)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetRecordId: 'lead-authoritative',
        }),
      ]),
    )
  })
})

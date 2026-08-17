import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  operationalEvidence: {
    upsert: vi.fn(),
  },
  operationalInsight: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  operationalInsightRevision: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  operationalInsightAudit: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  operationalRecommendationHistory: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  operationalRecommendationOutcome: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  operationalExplanation: {
    upsert: vi.fn(),
  },
  operationalDecision: {
    upsert: vi.fn(),
  },
  operationalSignal: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  operationalMetricHistory: {
    create: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  operationalKnowledgeEffectiveness: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  operationalKnowledgeUsage: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  operationalHealthSnapshot: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  operationalDashboardSignal: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}))

import {
  getOperationalHistory,
  persistOperationalIntelligenceSnapshot,
  recordOperationalRecommendationOutcome,
} from '@/lib/ai/operational/operationalIntelligenceStore'
import type { OperationalIntelligenceSnapshot } from '@/lib/ai/operational/operationalIntelligence'

const now = new Date('2026-08-04T12:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Operational Intelligence store', () => {
  it('persists current operational health without mutating workspace knowledge or executing actions', async () => {
    prismaMock.operationalSignal.findUnique.mockResolvedValue(null)
    prismaMock.operationalSignal.create.mockResolvedValue({
      id: 'signal-row-1',
    })
    prismaMock.operationalMetricHistory.upsert.mockResolvedValue({
      id: 'metric-row-1',
    })
    prismaMock.operationalHealthSnapshot.upsert.mockResolvedValue({
      id: 'health-row-1',
    })
    prismaMock.operationalDashboardSignal.upsert.mockResolvedValue({
      id: 'dashboard-signal-1',
    })

    const result = await persistOperationalIntelligenceSnapshot({
      snapshot: minimalSnapshot(),
    })

    expect(result).toMatchObject({
      workspaceId: 'workspace-1',
      snapshotId: 'operational-intelligence:response-1',
      signalIds: ['signal-row-1'],
      metricHistoryIds: ['metric-row-1'],
      healthSnapshotId: 'health-row-1',
      dashboardSignalIds: ['dashboard-signal-1'],
    })
    expect(prismaMock.operationalHealthSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          workspaceId: 'workspace-1',
          sourceResponseId: 'response-1',
        }),
      }),
    )
  })

  it('treats the same runtime request as an idempotent retry', async () => {
    mockNonInsightPersistence()
    prismaMock.operationalInsight.findUnique.mockResolvedValue({
      id: 'insight-row-1',
      status: 'NEW',
      occurrenceCount: 1,
      firstSeenAt: now,
      currentVersion: 1,
      sourceRuntimeRequestId: 'runtime-1',
    })
    prismaMock.operationalInsight.update.mockResolvedValue({
      id: 'insight-row-1',
      status: 'NEW',
      severity: 'WARNING',
      confidence: 'HIGH',
      title: 'Scheduling risk',
      summary: 'A scheduling issue recurred.',
      linkedEvidenceIds: ['evidence-1'],
      linkedRecommendationIds: [],
      currentVersion: 1,
    })
    prismaMock.operationalInsightRevision.upsert.mockResolvedValue({
      id: 'revision-1',
    })
    prismaMock.operationalInsightAudit.upsert.mockResolvedValue({
      id: 'audit-1',
    })

    await persistOperationalIntelligenceSnapshot({
      snapshot: snapshotWithInsight({ runtimeRequestId: 'runtime-1' }),
    })

    expect(prismaMock.operationalInsight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          occurrenceCount: 1,
          currentVersion: 1,
          sourceRuntimeRequestId: 'runtime-1',
        }),
      }),
    )
    expect(prismaMock.operationalInsightRevision.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: expect.stringContaining('runtime-1') },
      }),
    )
  })

  it('treats the same finding with a new runtime request as a new observation', async () => {
    mockNonInsightPersistence()
    prismaMock.operationalInsight.findUnique.mockResolvedValue({
      id: 'insight-row-1',
      status: 'ACTIVE',
      occurrenceCount: 1,
      firstSeenAt: now,
      currentVersion: 1,
      sourceRuntimeRequestId: 'runtime-1',
    })
    prismaMock.operationalInsight.update.mockResolvedValue({
      id: 'insight-row-1',
      status: 'RECURRING',
      severity: 'WARNING',
      confidence: 'HIGH',
      title: 'Scheduling risk',
      summary: 'A scheduling issue recurred.',
      linkedEvidenceIds: ['evidence-1'],
      linkedRecommendationIds: [],
      currentVersion: 2,
    })
    prismaMock.operationalInsightRevision.upsert.mockResolvedValue({
      id: 'revision-2',
    })
    prismaMock.operationalInsightAudit.upsert.mockResolvedValue({
      id: 'audit-2',
    })

    await persistOperationalIntelligenceSnapshot({
      snapshot: snapshotWithInsight({ runtimeRequestId: 'runtime-2' }),
    })

    expect(prismaMock.operationalInsight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          occurrenceCount: 2,
          currentVersion: { increment: 1 },
          sourceRuntimeRequestId: 'runtime-2',
        }),
      }),
    )
    expect(prismaMock.operationalInsightRevision.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: expect.stringContaining('runtime-2') },
      }),
    )
  })

  it('records governed recommendation outcomes as long-term metadata', async () => {
    prismaMock.operationalRecommendationOutcome.create.mockResolvedValue({
      id: 'outcome-row-1',
    })

    await recordOperationalRecommendationOutcome({
      workspaceId: 'workspace-1',
      recommendationId: 'recommendation-1',
      outcome: 'partiallySuccessful',
      actorUserId: 'user-1',
      evidenceIds: ['evidence-1'],
      occurredAt: now,
    })

    expect(
      prismaMock.operationalRecommendationOutcome.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        recommendationId: 'recommendation-1',
        outcome: 'PARTIALLY_SUCCESSFUL',
        actorUserId: 'user-1',
        evidenceIds: ['evidence-1'],
        occurredAt: now,
      }),
    })
  })

  it('reads workspace-scoped history for deterministic aggregation', async () => {
    prismaMock.operationalInsight.findMany.mockResolvedValue([
      {
        id: 'insight-row-1',
        workspaceId: 'workspace-1',
        fingerprint: 'crm:aging',
        domain: 'crm',
        title: 'CRM risk',
        summary: 'Aging leads recurred.',
        status: 'RECURRING',
        severity: 'WARNING',
        confidence: 'MEDIUM',
        firstSeenAt: now,
        lastSeenAt: now,
        occurrenceCount: 2,
        linkedEvidenceIds: ['evidence-1'],
        linkedRecommendationIds: ['recommendation-1'],
      },
    ])
    prismaMock.operationalMetricHistory.findMany.mockResolvedValue([])
    prismaMock.operationalRecommendationOutcome.findMany.mockResolvedValue([])
    prismaMock.operationalKnowledgeEffectiveness.findMany.mockResolvedValue([])
    prismaMock.operationalDashboardSignal.findMany.mockResolvedValue([])

    const history = await getOperationalHistory({
      workspaceId: 'workspace-1',
    })

    expect(history.insights[0]).toMatchObject({
      workspaceId: 'workspace-1',
      status: 'RECURRING',
      severity: 'WARNING',
    })
    expect(prismaMock.operationalInsight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'workspace-1' },
      }),
    )
  })
})

function minimalSnapshot(): OperationalIntelligenceSnapshot {
  const healthSignal = {
    key: 'schedulingHealth' as const,
    label: 'Scheduling Health',
    status: 'healthy' as const,
    summary: 'Scheduling evidence was inspected.',
    confidence: 'high' as const,
    evidenceIds: ['evidence-1'],
  }
  return {
    id: 'operational-intelligence:response-1',
    workspaceId: 'workspace-1',
    responseId: 'response-1',
    runtimeRequestId: 'runtime-1',
    createdAt: now.toISOString(),
    layer: 'operational-intelligence',
    deterministic: true,
    proposalOnly: true,
    operationalInsights: [],
    decisionExplanations: [],
    businessRulesApplied: [],
    rejectedAlternatives: [],
    evidenceRanking: [],
    knowledgeEffectiveness: [],
    insightGeneration: {
      generatedCount: 0,
      sourceDomains: [],
      skippedDomains: [],
      rules: [],
      proposalOnly: true,
      executedActions: 0,
      knowledgeMutations: 0,
    },
    recommendationJustifications: [],
    operationalHealth: [healthSignal],
    futureDashboardSignals: {
      topPriority: signal('topPriority', 'Top Priority'),
      ownerFocus: signal('ownerFocus', 'Owner Focus'),
      businessRisk: signal('businessRisk', 'Business Risk'),
      schedulingHealth: healthSignal,
      crmHealth: signal('crmHealth', 'CRM Health'),
      automationHealth: signal('automationHealth', 'Automation Health'),
      marketingHealth: signal('marketingHealth', 'Marketing Health'),
      financeHealth: signal('financeHealth', 'Finance Health'),
      knowledgeHealth: signal('knowledgeHealth', 'Knowledge Health'),
      aiConfidence: {
        key: 'aiConfidence',
        label: 'AI Confidence',
        status: 'healthy',
        summary: 'High confidence.',
        confidence: 'high',
        evidenceIds: [],
      },
    },
    audit: {
      executedActions: 0,
      knowledgeMutations: 0,
      approvalsCreated: 0,
    },
  }
}

function snapshotWithInsight({
  runtimeRequestId,
}: {
  runtimeRequestId: string
}): OperationalIntelligenceSnapshot {
  return {
    ...minimalSnapshot(),
    id: `operational-intelligence:${runtimeRequestId}`,
    responseId: `response:${runtimeRequestId}`,
    runtimeRequestId,
    operationalInsights: [
      {
        id: 'operational-insight:scheduling-risk',
        domain: 'scheduling',
        title: 'Scheduling risk',
        summary: 'A scheduling issue recurred.',
        severity: 'warning',
        priority: 'high',
        confidence: 'high',
        evidenceIds: ['evidence-1'],
        generatedAt: now.toISOString(),
        deterministic: true,
      },
    ],
  }
}

function mockNonInsightPersistence() {
  prismaMock.operationalSignal.findUnique.mockResolvedValue(null)
  prismaMock.operationalSignal.create.mockResolvedValue({ id: 'signal-row-1' })
  prismaMock.operationalMetricHistory.upsert.mockResolvedValue({
    id: 'metric-row-1',
  })
  prismaMock.operationalHealthSnapshot.upsert.mockResolvedValue({
    id: 'health-row-1',
  })
  prismaMock.operationalDashboardSignal.upsert.mockResolvedValue({
    id: 'dashboard-signal-1',
  })
}

function signal(
  key: OperationalIntelligenceSnapshot['futureDashboardSignals']['topPriority']['key'],
  label: string,
) {
  return {
    key,
    label,
    status: 'unknown' as const,
    summary: `${label} was not inspected.`,
    confidence: 'unknown' as const,
    evidenceIds: [],
  }
}

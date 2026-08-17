import { describe, expect, it } from 'vitest'

import {
  aggregateCRMHealth,
  aggregateOperationalHealth,
  aggregateRecommendationHistory,
  aggregateRiskHistory,
  buildOperationalHistoryInspection,
  createOperationalFingerprint,
  deriveOperationalInsightLifecycle,
  detectOperationalTrends,
  type OperationalHistorySnapshot,
} from '@/lib/ai/operational/operationalHistory'
import type { OperationalIntelligenceSnapshot } from '@/lib/ai/operational/operationalIntelligence'

const now = '2026-08-04T12:00:00.000Z'

describe('Operational history aggregation', () => {
  it('derives lifecycle state and recurring patterns deterministically', () => {
    const incoming = {
      id: 'operational-insight:crm:aging-leads',
      domain: 'crm' as const,
      title: 'CRM quality signal detected',
      summary: 'Aging lead evidence appeared again.',
      severity: 'warning' as const,
      confidence: 'medium' as const,
      evidenceIds: ['evidence:crm:aging'],
    }

    const first = deriveOperationalInsightLifecycle({ incoming, now })
    const second = deriveOperationalInsightLifecycle({
      existing: first,
      incoming,
      now: '2026-08-05T12:00:00.000Z',
    })

    expect(first.status).toBe('NEW')
    expect(second.status).toBe('RECURRING')
    expect(second.occurrenceCount).toBe(2)
    expect(second.fingerprint).toBe(createOperationalFingerprint(incoming))
  })

  it('detects improving, stable, declining, and unknown trends from metric history', () => {
    const trends = detectOperationalTrends([
      point(
        'automation',
        'successRate',
        'Automation success',
        72,
        '2026-08-01T00:00:00.000Z',
      ),
      point(
        'automation',
        'successRate',
        'Automation success',
        80,
        '2026-08-02T00:00:00.000Z',
      ),
      point(
        'crm',
        'dataQuality',
        'CRM quality',
        60,
        '2026-08-01T00:00:00.000Z',
      ),
      point(
        'crm',
        'dataQuality',
        'CRM quality',
        55,
        '2026-08-02T00:00:00.000Z',
      ),
      point(
        'scheduling',
        'balance',
        'Assignment balance',
        50,
        '2026-08-01T00:00:00.000Z',
      ),
      point(
        'scheduling',
        'balance',
        'Assignment balance',
        50,
        '2026-08-02T00:00:00.000Z',
      ),
      point(
        'workspaceKnowledge',
        'confidence',
        'Knowledge confidence',
        1,
        '2026-08-02T00:00:00.000Z',
      ),
    ])

    expect(
      trends.find((trend) => trend.domain === 'automation')?.direction,
    ).toBe('IMPROVING')
    expect(trends.find((trend) => trend.domain === 'crm')?.direction).toBe(
      'DECLINING',
    )
    expect(
      trends.find((trend) => trend.domain === 'scheduling')?.direction,
    ).toBe('STABLE')
    expect(
      trends.find((trend) => trend.domain === 'workspaceKnowledge')?.direction,
    ).toBe('UNKNOWN')
  })

  it('aggregates health, risks, and recommendation outcomes without inventing records', () => {
    const history: OperationalHistorySnapshot = {
      workspaceId: 'workspace-1',
      createdAt: now,
      insights: [
        {
          id: 'insight-1',
          workspaceId: 'workspace-1',
          fingerprint: 'crm:aging',
          domain: 'crm',
          title: 'CRM aging leads',
          summary: 'Repeated CRM aging lead risk.',
          status: 'RECURRING',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          firstSeenAt: '2026-08-01T00:00:00.000Z',
          lastSeenAt: now,
          occurrenceCount: 3,
          linkedEvidenceIds: ['evidence-1'],
          linkedRecommendationIds: ['recommendation-1'],
        },
      ],
      trends: [
        {
          key: 'crm:dataQuality',
          domain: 'crm',
          metric: 'CRM quality',
          direction: 'DECLINING',
          confidence: 'medium',
          evidenceIds: [],
        },
      ],
      recommendationOutcomes: [
        {
          recommendationId: 'recommendation-1',
          status: 'GENERATED',
          occurredAt: now,
          sourceDomain: 'crm',
        },
        {
          recommendationId: 'recommendation-1',
          status: 'IGNORED',
          occurredAt: now,
          sourceDomain: 'crm',
        },
      ],
      knowledgeEffectiveness: [],
      dashboardSignals: [],
    }

    expect(aggregateCRMHealth(history)).toMatchObject({
      status: 'watch',
      recurringRiskCount: 1,
      trendDirection: 'DECLINING',
    })
    expect(aggregateOperationalHealth(history)).toMatchObject({
      status: 'watch',
      recurringRiskCount: 1,
      trendDirection: 'DECLINING',
    })
    expect(aggregateRiskHistory(history)).toHaveLength(1)
    expect(aggregateRecommendationHistory(history)).toEqual({
      total: 2,
      counts: {
        GENERATED: 1,
        IGNORED: 1,
      },
    })
  })

  it('builds developer inspection panels from a current operational snapshot', () => {
    const inspection = buildOperationalHistoryInspection({
      currentSnapshot: operationalSnapshot(),
    })

    expect(inspection.operationalHistory).toMatchObject({
      workspaceId: 'workspace-1',
      persisted: false,
      insightCount: 1,
    })
    expect(inspection.insightLifecycle[0]).toMatchObject({
      status: 'NEW',
      occurrenceCount: 1,
    })
    expect(inspection.dashboardSignals[0]?.label).toBe('Scheduling Health')
    expect(inspection.operationalConfidence).toMatchObject({
      level: 'high',
      evidenceCount: 1,
    })
  })
})

function point(
  domain: string,
  metricKey: string,
  metric: string,
  value: number,
  measuredAt: string,
) {
  return {
    domain,
    metricKey,
    metric,
    value,
    measuredAt,
  }
}

function operationalSnapshot(): OperationalIntelligenceSnapshot {
  return {
    id: 'operational-intelligence:response-1',
    workspaceId: 'workspace-1',
    responseId: 'response-1',
    runtimeRequestId: 'runtime-1',
    createdAt: now,
    layer: 'operational-intelligence',
    deterministic: true,
    proposalOnly: true,
    operationalInsights: [
      {
        id: 'insight:scheduling',
        domain: 'scheduling',
        title: 'Scheduling signal detected',
        summary: 'Scheduling evidence was inspected.',
        severity: 'info',
        priority: 'medium',
        confidence: 'high',
        evidenceIds: ['evidence:scheduling'],
        generatedAt: now,
        deterministic: true,
      },
    ],
    decisionExplanations: [],
    businessRulesApplied: [],
    rejectedAlternatives: [],
    evidenceRanking: [
      {
        rank: 1,
        evidenceId: 'evidence:scheduling',
        label: 'Scheduling snapshot',
        domain: 'scheduling',
        confidence: 'high',
        verified: true,
        reason: 'Verified workspace evidence.',
      },
    ],
    knowledgeEffectiveness: [],
    insightGeneration: {
      generatedCount: 1,
      sourceDomains: ['scheduling'],
      skippedDomains: [],
      rules: [],
      proposalOnly: true,
      executedActions: 0,
      knowledgeMutations: 0,
    },
    recommendationJustifications: [],
    operationalHealth: [
      {
        key: 'schedulingHealth',
        label: 'Scheduling Health',
        status: 'healthy',
        summary: 'Scheduling evidence was inspected.',
        confidence: 'high',
        evidenceIds: ['evidence:scheduling'],
      },
    ],
    futureDashboardSignals: {
      topPriority: {
        key: 'topPriority',
        label: 'Top Priority',
        status: 'healthy',
        summary: 'Scheduling evidence was inspected.',
        confidence: 'high',
        evidenceIds: ['evidence:scheduling'],
      },
      ownerFocus: signal('ownerFocus', 'Owner Focus'),
      businessRisk: signal('businessRisk', 'Business Risk'),
      schedulingHealth: {
        key: 'schedulingHealth',
        label: 'Scheduling Health',
        status: 'healthy',
        summary: 'Scheduling evidence was inspected.',
        confidence: 'high',
        evidenceIds: ['evidence:scheduling'],
      },
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
        evidenceIds: ['evidence:scheduling'],
      },
    },
    audit: {
      executedActions: 0,
      knowledgeMutations: 0,
      approvalsCreated: 0,
    },
  }
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

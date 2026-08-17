import { describe, expect, it } from 'vitest'

import { buildOperationalIntelligenceSnapshot } from '@/lib/ai/operational/operationalIntelligence'
import type { AIRuntimeResponse } from '@/lib/ai/runtime/workspaceAIRuntime'
import type { WorkspaceReasoningSnapshot } from '@/lib/ai/reasoning/workspaceReasoningEngine'

const now = new Date('2026-08-04T12:00:00.000Z')

function reasoningSnapshot(
  overrides: Partial<WorkspaceReasoningSnapshot> = {},
): WorkspaceReasoningSnapshot {
  return {
    id: 'reasoning-snapshot:request-1',
    requestId: 'request-1',
    createdAt: now.toISOString(),
    immutable: true,
    investigationGoal:
      'Determine the safest answer using deterministic evidence.',
    investigationPlan: [],
    evidence: [
      {
        id: 'evidence:scheduling:workload',
        label: 'Scheduling workload snapshot',
        source: 'scheduling',
        provider: 'scheduling',
        domain: 'scheduling',
        confidence: 'high',
        verified: true,
        timestamp: now.toISOString(),
        type: 'snapshot',
        referenceId: 'reference:scheduling:1',
      },
      {
        id: 'evidence:crm:aging',
        label: 'CRM aging leads snapshot',
        source: 'crm',
        provider: 'crm',
        domain: 'crm',
        confidence: 'medium',
        verified: true,
        timestamp: now.toISOString(),
        type: 'snapshot',
        referenceId: 'reference:crm:1',
      },
    ],
    evidenceGroups: [
      {
        domain: 'scheduling',
        evidenceIds: ['evidence:scheduling:workload'],
        confidence: 'high',
        summary:
          'Scheduling evidence was inspected for workload and availability.',
      },
      {
        domain: 'crm',
        evidenceIds: ['evidence:crm:aging'],
        confidence: 'medium',
        summary: 'CRM evidence was inspected for lead and opportunity risk.',
      },
    ],
    contradictions: [],
    missingInformation: [
      {
        id: 'missing:automation',
        label: 'Automation run history is unavailable.',
        whyItMatters: 'Failed workflow runs cannot be ranked.',
        confidenceImpact: 'medium',
        domain: 'automation',
      },
    ],
    businessRulesApplied: [
      {
        id: 'rule:manager-approval',
        rule: 'Manager approval is required before reassigning urgent jobs.',
        source: 'approved-workspace-knowledge',
        confidence: 'high',
        referenceId: 'knowledge:rule:1',
      },
    ],
    reasoningChain: [],
    rootCauseRanking: [],
    recommendationRanking: [
      {
        rank: 1,
        recommendation: 'Review scheduling workload before reassignment.',
        priority: 'high',
        businessImpact: 'Reduces scheduling risk.',
        risk: 'Incomplete automation data.',
        confidence: 'high',
        dependencies: [],
        requiredApprovals: ['manager'],
        estimatedEffort: 'low',
        evidenceIds: ['evidence:scheduling:workload'],
      },
    ],
    proposalCandidates: [],
    confidenceReport: {
      overall: 'high',
      score: 88,
      investigation: 'high',
      perDomain: [],
      perRecommendation: [],
      perProposal: [],
      rationale: [],
    },
    coverageReport: {
      inspectedDomains: ['scheduling', 'crm'],
      skippedDomains: [],
      couldNotInspect: [],
    },
    learningOpportunities: [],
    providerInstructions: [],
    ...overrides,
  }
}

function runtimeResponse(
  overrides: Partial<AIRuntimeResponse> = {},
): AIRuntimeResponse {
  const snapshot = reasoningSnapshot()
  return {
    requestId: 'runtime-request-1',
    intent: 'scheduling.findBestMember',
    confidence: 'high',
    providerUsage: {
      knowledgeProviderIds: ['scheduling', 'crm'],
      llmProviderId: 'mock',
    },
    toolUsage: {
      eligibleToolIds: [],
      requestedToolIds: [],
      executedToolIds: [],
    },
    knowledgeReferences: [],
    structuredResponse: {
      intent: 'scheduling.findBestMember',
      type: 'recommendations',
      confidence: 'high',
      recommendations: [
        {
          id: 'recommendation:field-tech',
          providerId: 'scheduling',
          intent: 'scheduling.findBestMember',
          subject: {
            id: 'member-field',
            type: 'member',
            label: 'Field Tech',
          },
          score: 92,
          confidence: 'high',
          reasons: [
            {
              code: 'available',
              label: 'Field Tech has availability in the requested window.',
              source: 'scheduling',
            },
          ],
          warnings: [],
          references: [
            {
              id: 'evidence:scheduling:workload',
              providerId: 'scheduling',
              domain: 'scheduling',
              kind: 'snapshot',
              label: 'Scheduling workload snapshot',
              scope: 'provider',
            },
          ],
        },
      ],
    },
    recommendedActions: [],
    warnings: [],
    citations: [],
    followUpSuggestions: [],
    executionRequests: [],
    prompt: {} as AIRuntimeResponse['prompt'],
    aiRequest: {} as AIRuntimeResponse['aiRequest'],
    reasoningSnapshot: snapshot,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      rejectedActionProposals: [],
    },
    providerOutcome: 'generated',
    events: [],
    ...overrides,
  }
}

describe('Operational Intelligence', () => {
  it('generates deterministic operational insights above Workspace AI without executing actions', () => {
    const snapshot = buildOperationalIntelligenceSnapshot({
      workspaceId: 'workspace-1',
      responseId: 'response-1',
      runtimeResponse: runtimeResponse(),
      now,
    })

    expect(snapshot.layer).toBe('operational-intelligence')
    expect(snapshot.deterministic).toBe(true)
    expect(snapshot.proposalOnly).toBe(true)
    expect(snapshot.audit).toEqual({
      executedActions: 0,
      knowledgeMutations: 0,
      approvalsCreated: 0,
    })
    expect(
      snapshot.operationalInsights.map((insight) => insight.domain),
    ).toEqual(expect.arrayContaining(['scheduling', 'crm', 'automation']))
    expect(snapshot.insightGeneration.executedActions).toBe(0)
    expect(snapshot.insightGeneration.knowledgeMutations).toBe(0)
  })

  it('does not crash when provider recommendations omit optional warning and reference arrays', () => {
    const sparseRecommendation = {
      id: 'recommendation:sparse-provider-output',
      providerId: 'scheduling',
      intent: 'scheduling.findBestMember',
      subject: {
        id: 'member-owner',
        type: 'member',
        label: 'Owner',
      },
      score: 90,
      confidence: 'high',
      reasons: [],
    }

    const snapshot = buildOperationalIntelligenceSnapshot({
      workspaceId: 'workspace-1',
      responseId: 'response-1',
      runtimeResponse: runtimeResponse({
        structuredResponse: {
          ...runtimeResponse().structuredResponse,
          recommendations: [sparseRecommendation as any],
        },
      }),
      now,
    })

    expect(snapshot.rejectedAlternatives).toEqual([])
    expect(snapshot.recommendationJustifications[0]?.recommendationId).toBe(
      'recommendation:sparse-provider-output',
    )
  })

  it('explains recommendations with evidence, business rules, and proposal-only justification', () => {
    const snapshot = buildOperationalIntelligenceSnapshot({
      workspaceId: 'workspace-1',
      responseId: 'response-1',
      runtimeResponse: runtimeResponse(),
      now,
    })

    expect(snapshot.decisionExplanations[0]).toMatchObject({
      recommendationId: 'recommendation:field-tech',
      recommendation: 'Field Tech',
      confidence: 'high',
    })
    expect(
      snapshot.decisionExplanations[0]?.businessRulesApplied[0]?.rule,
    ).toBe('Manager approval is required before reassigning urgent jobs.')
    expect(snapshot.decisionExplanations[0]?.evidence[0]?.evidenceId).toBe(
      'evidence:scheduling:workload',
    )
    expect(snapshot.recommendationJustifications[0]).toMatchObject({
      recommendationId: 'recommendation:field-tech',
      proposalOnly: true,
    })
  })

  it('tracks knowledge effectiveness and dashboard-ready health signals', () => {
    const snapshot = buildOperationalIntelligenceSnapshot({
      workspaceId: 'workspace-1',
      responseId: 'response-1',
      runtimeResponse: runtimeResponse(),
      now,
    })

    expect(snapshot.knowledgeEffectiveness[0]).toMatchObject({
      id: 'knowledge-effectiveness:rule:manager-approval',
      timesUsed: 1,
      recommendationsGenerated: 1,
      conflictsGenerated: 0,
    })
    expect(snapshot.futureDashboardSignals).toMatchObject({
      topPriority: expect.objectContaining({ label: 'Top Priority' }),
      schedulingHealth: expect.objectContaining({ label: 'Scheduling Health' }),
      crmHealth: expect.objectContaining({ label: 'CRM Health' }),
      knowledgeHealth: expect.objectContaining({ label: 'Knowledge Health' }),
      aiConfidence: expect.objectContaining({ label: 'AI Confidence' }),
    })
  })
})

import { describe, expect, it } from 'vitest'

import { buildAIPlaygroundReadableResult } from '@/lib/ai/playground/readableResult'

const baseResult = {
  ok: true,
  provider: {
    id: 'openai',
    label: 'OpenAI',
    runtimeProviderId: 'openai-generation',
  },
  inspection: {
    actionExecution: 'not-executed',
    recommendationSource: {
      sourceProviderId: 'scheduling',
      sourceEngine: 'Scheduling Knowledge',
      deterministic: true,
      scoreScale: '0-100',
    },
    providerVerification: {
      invoked: true,
      selectedProviderLabel: 'OpenAI',
      invokedProviderId: 'openai-generation',
      recommendationSource: {
        sourceProviderId: 'scheduling',
        sourceEngine: 'Scheduling Knowledge',
        deterministic: true,
        scoreScale: '0-100',
      },
    },
  },
}

describe('buildAIPlaygroundReadableResult', () => {
  it('uses structured answer summary and details as the primary readable answer', () => {
    const readable = buildAIPlaygroundReadableResult({
      ...baseResult,
      response: {
        intent: 'analyzeSchedule',
        confidence: 'high',
        workspaceAIResponse: {
          runtimeResponse: {
            structuredResponse: {
              answer: {
                summary: 'OpenAI summarized the deterministic schedule.',
                details: [
                  'No conflicts were found.',
                  'No overloaded members were found.',
                ],
              },
              reasoningSummary: 'Reasoning fallback should not be used.',
            },
          },
        },
        analysis: {
          summary: 'Deterministic analysis fallback should not be primary.',
        },
      },
    })

    expect(readable.title).toBe('Schedule Summary')
    expect(readable.summary).toBe(
      'OpenAI summarized the deterministic schedule.',
    )
    expect(readable.details).toContain('No conflicts were found.')
    expect(readable.provenance.responseSourceLabel).toContain('OpenAI')
  })

  it('uses reasoningSummary only when answer summary is missing', () => {
    const readable = buildAIPlaygroundReadableResult({
      ...baseResult,
      response: {
        intent: 'analyzeSchedule',
        workspaceAIResponse: {
          runtimeResponse: {
            structuredResponse: {
              reasoningSummary: 'Reasoning summary became readable.',
            },
          },
        },
      },
    })

    expect(readable.summary).toBe('Reasoning summary became readable.')
  })

  it('builds deterministic Scheduling details from analysis facts without multiplying scores', () => {
    const readable = buildAIPlaygroundReadableResult({
      ...baseResult,
      response: {
        intent: 'recommendTechnician',
        responseKind: 'recommendation',
        confidence: 'high',
        analysis: {
          summary:
            '0 conflicts, 1 assignee, and 0 calendar provider health records were analyzed.',
          snapshot: {
            counts: { events: 1, conflicts: 0 },
          },
          workload: [{ label: 'Owner', busyMinutes: 0, overloaded: false }],
          conflicts: [],
        },
        recommendations: [
          {
            id: 'recommendation-member-corbin',
            label: 'Corbin Wesche',
            score: 90,
            confidence: 'high',
            reasons: [{ label: 'No blocking conflicts', code: 'available' }],
            warnings: [],
            provenance: {
              sourceEngine: 'Scheduling Knowledge',
              deterministic: true,
            },
          },
        ],
        actionProposals: [
          {
            id: 'proposal-1',
            label: 'Assign Corbin Wesche',
            executionBoundary: 'proposal-only',
            approval: { status: 'pending' },
          },
        ],
      },
    })

    expect(readable.details).toContain(
      'No active scheduling conflicts were detected in the analyzed range.',
    )
    expect(readable.recommendations[0]).toMatchObject({
      title: 'Corbin Wesche',
      scoreLabel: 'Score 90%',
      source: 'Scheduling Knowledge',
      deterministic: true,
    })
    expect(readable.proposals[0]).toMatchObject({
      title: 'Assign Corbin Wesche',
      approvalRequired: true,
      executionStatus: 'proposal-only',
    })
  })

  it('normalizes warnings and follow-up suggestions', () => {
    const readable = buildAIPlaygroundReadableResult({
      ...baseResult,
      response: {
        intent: 'analyzeConflicts',
        warnings: [
          {
            code: 'partial',
            message: 'Provider returned a partial structured response.',
          },
        ],
        workspaceAIResponse: {
          followUpSuggestions: ['Show overloaded technicians'],
          runtimeResponse: {
            structuredResponse: {
              answer: { summary: 'Conflict analysis completed.' },
              followUpSuggestions: ['Find unassigned work'],
            },
          },
        },
      },
    })

    expect(readable.warnings.map((warning) => warning.message)).toContain(
      'Provider returned a partial structured response.',
    )
    expect(readable.followUpSuggestions).toEqual([
      'Show overloaded technicians',
      'Find unassigned work',
    ])
  })

  it('returns a truthful CRM empty state when authoritative CRM records are unavailable', () => {
    const readable = buildAIPlaygroundReadableResult({
      ...baseResult,
      provider: {
        id: 'mock',
        label: 'Mock',
        runtimeProviderId: 'mock-ai-provider',
      },
      inspection: {
        actionExecution: 'not-executed',
        recommendationSource: {
          sourceProviderId: 'crm',
          sourceEngine: 'CRM Knowledge Provider',
          deterministic: true,
          scoreScale: '0-100',
        },
        providerVerification: {
          invoked: true,
          selectedProviderLabel: 'Mock',
          invokedProviderId: 'mock-ai-provider',
          recommendationSource: {
            sourceProviderId: 'crm',
            sourceEngine: 'CRM Knowledge Provider',
            deterministic: true,
            scoreScale: '0-100',
          },
        },
      },
      response: {
        intent: 'crmOverview',
        routedIntent: 'crm.analyzePipeline',
        confidence: 'medium',
        summary: {
          title: 'CRM Overview',
          summary:
            '0 active leads with 0 overdue follow-ups and $0 active lead value. 0 open opportunities worth $0 with $0 weighted expected revenue.',
        },
        recommendations: [],
      },
    })

    expect(readable.title).toBe('CRM Overview')
    expect(readable.emptyState).toMatchObject({
      title: 'No authoritative CRM records available',
    })
    expect(readable.summary).toContain('CRM Knowledge is registered')
    expect(readable.details).not.toContain('Scheduling Knowledge')
    expect(readable.provenance.knowledgeProvider).toBe('CRM Knowledge Provider')
  })

  it('produces a safe fallback for malformed output', () => {
    const readable = buildAIPlaygroundReadableResult({
      ok: true,
      provider: { label: 'Mock' },
      response: { intent: 'analyzeSchedule' },
      inspection: {},
    })

    expect(readable.title).toBe('Schedule Summary')
    expect(readable.summary).toBe(
      'Scheduling AI completed without a displayable summary.',
    )
    expect(readable.recommendations).toEqual([])
  })

  it('keeps proposal-requested responses renderable when no proposal is returned', () => {
    const readable = buildAIPlaygroundReadableResult({
      ...baseResult,
      response: {
        intent: 'recommendTechnician',
        responseKind: 'recommendation',
        actionProposalRequested: true,
        summary: {
          title: 'Technician Recommendation',
          summary: 'A recommendation was returned without a proposal.',
        },
        recommendations: [],
        actionProposals: undefined,
        actionProposalPlans: undefined,
        workspaceAIResponse: {
          runtimeResponse: {
            structuredResponse: {
              type: 'recommendations',
              confidence: 'medium',
            },
            providerOutcome: 'generated',
          },
        },
      },
    })

    expect(readable.summary).toBe(
      'A recommendation was returned without a proposal.',
    )
    expect(readable.proposals).toEqual([])
    expect(readable.proposalPlans).toEqual([])
    expect(readable.proposalUnavailable).toBe(true)
  })
})

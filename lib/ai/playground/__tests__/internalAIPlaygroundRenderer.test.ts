import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InternalAIPlayground } from '@/components/ai/InternalAIPlayground'
import { AI_PLAYGROUND_DOMAINS } from '@/lib/ai/playground/aiPlayground'

const playgroundProps: React.ComponentProps<typeof InternalAIPlayground> = {
  workspaceId: 'workspace-1',
  workspaceSlug: 'acme-workspace',
  workspaceName: 'Acme Workspace',
  domains: AI_PLAYGROUND_DOMAINS,
  providerOptions: [
    {
      id: 'mock',
      label: 'Mock',
      description: 'Deterministic structured output.',
      runtimeProviderId: 'mock-ai-provider',
      status: 'available',
      exposure: 'internalOnly',
    },
    {
      id: 'openai',
      label: 'OpenAI',
      description: 'Production provider path.',
      runtimeProviderId: 'openai-generation',
      status: 'available',
      exposure: 'customerAvailable',
    },
  ],
  contextOptions: {
    scheduling: [
      { id: 'events', label: 'Event', options: [] },
      { id: 'members', label: 'Member', options: [] },
      { id: 'teams', label: 'Team', options: [] },
      { id: 'locations', label: 'Location', options: [] },
    ],
    crm: [
      { id: 'leads', label: 'Lead', options: [] },
      { id: 'opportunities', label: 'Opportunity', options: [] },
      { id: 'clients', label: 'Client', options: [] },
      { id: 'owners', label: 'Owner', options: [] },
      { id: 'leadStages', label: 'Lead stage', options: [] },
      { id: 'opportunityStages', label: 'Opportunity stage', options: [] },
      { id: 'selectedRecords', label: 'Selected records', options: [] },
    ],
  },
}

const eventOption = {
  kind: 'event' as const,
  id: 'event-summit-aug-5',
  label:
    'Quarterly maintenance visit — Summit Foods — Aug 5, 4:15 PM — Mike Johnson',
  secondaryLabel: 'Scheduled · Summit Foods',
  metadata: {
    startsAt: '2026-08-05T20:15:00.000Z',
    dateTimeLabel: 'Aug 5, 4:15 PM',
    assignmentLabel: 'Mike Johnson',
    locationLabel: 'Summit Foods',
    customerLabel: 'Summit Foods',
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InternalAIPlayground runtime events renderer', () => {
  it('shows clarification options and lets a user select an appointment without auto-running', async () => {
    const user = userEvent.setup()
    const submittedBodies: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        submittedBodies.push(JSON.parse(String(init?.body ?? '{}')))
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                confidence: 'medium',
                responseKind: 'clarification',
                summary: {
                  title: 'Clarification needed',
                  summary:
                    'Which appointment would you like me to assign a technician to?',
                },
                clarification: {
                  missingContext: ['appointment'],
                  availableOptions: [eventOption],
                },
                warnings: [
                  {
                    code: 'missing-context',
                    message: 'Required context is missing for this request.',
                    severity: 'info',
                  },
                ],
                recommendations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        })
      }),
    )

    render(
      React.createElement(InternalAIPlayground, {
        ...playgroundProps,
        contextOptions: {
          ...playgroundProps.contextOptions,
          scheduling: [
            { id: 'events', label: 'Event', options: [eventOption] },
            ...playgroundProps.contextOptions.scheduling.slice(1),
          ],
        },
      }),
    )
    const requestField = screen.getByRole('textbox', { name: /^Request$/i })
    await user.clear(requestField)
    await user.type(requestField, 'Assign the best person.')
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(await screen.findByText('Select an appointment')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: /Quarterly maintenance visit/i }),
    )
    expect((screen.getByLabelText(/event/i) as HTMLSelectElement).value).toBe(
      eventOption.id,
    )
    expect(submittedBodies).toHaveLength(1)
    expect(
      screen.queryByText('Required context is missing for this request.'),
    ).toBeNull()
  })

  it('renders malformed runtime events as an empty state without crashing', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                routedIntent: 'workspace.investigate',
                intent: 'investigateWorkspace',
                confidence: 'high',
                summary: {
                  title: 'Schedule summary',
                  summary: 'The scheduling response still renders.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: '[circular]',
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(
      await screen.findAllByText('The scheduling response still renders.'),
    ).toHaveLength(2)
    expect(screen.getByText('AI Response')).toBeTruthy()
    expect(screen.queryByText('Runtime events')).toBeNull()
    await user.click(
      screen.getByRole('button', { name: /developer inspection/i }),
    )
    expect(screen.getByText('No runtime events were returned.')).toBeTruthy()
  })

  it('renders runtime events when the API returns an event array', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                confidence: 'high',
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [
                  {
                    id: 'runtime-event-1',
                    type: 'AIProviderInvoked',
                    requestId: 'request-1',
                    createdAt: '2026-07-30T14:00:00.000Z',
                    metadata: { providerId: 'mock-ai-provider' },
                  },
                ],
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))
    await user.click(
      await screen.findByRole('button', { name: /developer inspection/i }),
    )

    await waitFor(() => {
      expect(screen.getByText('AIProviderInvoked')).toBeTruthy()
    })
    expect(screen.queryByText('No runtime events were returned.')).toBeNull()
  })

  it('runs the same prompt twice as independent playground requests', async () => {
    const user = userEvent.setup()
    const submittedBodies: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        submittedBodies.push(JSON.parse(String(init?.body ?? '{}')))
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                routedIntent: 'workspace.investigateQuestion',
                intent: 'investigateWorkspace',
                confidence: 'high',
                summary: {
                  title: 'Workspace answer',
                  summary: 'The response completed.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        })
      }),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))
    expect(await screen.findAllByText('The response completed.')).toHaveLength(
      2,
    )
    await user.click(screen.getByRole('button', { name: /run test/i }))

    await waitFor(() => expect(submittedBodies).toHaveLength(2))
    expect(submittedBodies[0].prompt).toBe(submittedBodies[1].prompt)
    expect(submittedBodies[0].clientRequestId).toMatch(/^playground-client:/)
    expect(submittedBodies[1].clientRequestId).toMatch(/^playground-client:/)
    expect(submittedBodies[0].clientRequestId).not.toBe(
      submittedBodies[1].clientRequestId,
    )
    expect(submittedBodies[0].conversation.priorTurns).toEqual([])
    expect(submittedBodies[1].conversation.priorTurns).toEqual([])
  })

  it('runs a different prompt after the first prompt without retaining stale failure state', async () => {
    const user = userEvent.setup()
    const submittedBodies: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        submittedBodies.push(JSON.parse(String(init?.body ?? '{}')))
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                confidence: 'high',
                summary: {
                  title: 'Workspace answer',
                  summary: 'The latest response completed.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        })
      }),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    const requestField = screen.getByRole('textbox', { name: /^Request$/i })
    await user.clear(requestField)
    await user.type(requestField, 'What should I focus on today?')
    await user.click(screen.getByRole('button', { name: /run test/i }))
    expect(
      await screen.findAllByText('The latest response completed.'),
    ).toHaveLength(2)

    await user.clear(requestField)
    await user.type(requestField, 'What conflicts do I have?')
    await user.click(screen.getByRole('button', { name: /run test/i }))

    await waitFor(() => expect(submittedBodies).toHaveLength(2))
    expect(submittedBodies[0].prompt).toBe('What should I focus on today?')
    expect(submittedBodies[1].prompt).toBe('What conflicts do I have?')
    expect(screen.queryByText(/failed before a response/i)).toBeNull()
  })

  it('shows safe diagnostics when the response is not parseable JSON', async () => {
    const user = userEvent.setup()
    const submittedBodies: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        submittedBodies.push(JSON.parse(String(init?.body ?? '{}')))
        return Promise.resolve({
          ok: false,
          json: () => Promise.reject(new Error('not-json')),
        })
      }),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(
      await screen.findByText(
        'The internal playground request failed before a response was returned.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('CLIENT_RESPONSE_PARSE_FAILED')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /retry test/i }))

    await waitFor(() => expect(submittedBodies).toHaveLength(2))
    expect(submittedBodies[1].clientRequestId).toBe(
      submittedBodies[0].clientRequestId,
    )
  })

  it('shows WorkspaceAIExperience builder diagnostics for failed playground runs', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              ok: false,
              requestId: 'request-workspace-ai-builder',
              error:
                'The internal playground request failed before a response was returned.',
              reason:
                'The Workspace AI experience failed while assembling the playground response.',
              diagnostic: {
                requestId: 'request-workspace-ai-builder',
                failureStage: 'aiExperienceRun',
                safeCode: 'AI_EXPERIENCE_RUN_FAILED',
                safeMessage:
                  'The Workspace AI experience failed while assembling the playground response.',
                retryable: true,
                responseGenerated: false,
                persistenceAttempted: false,
                persistenceSucceeded: false,
                lastCompletedStage: 'PROVIDER_REQUEST_BUILT',
                nextExpectedStage: 'AI_EXPERIENCE_RUN',
                workspaceAIExperience: {
                  requestId: 'request-workspace-ai-builder',
                  runtimeRequestId: 'runtime-workspace-ai-builder',
                  builder: 'buildOperationalIntelligence',
                  functionName: 'buildOperationalIntelligence',
                  file: 'lib/ai/operational/operationalIntelligence.ts',
                  line: 399,
                  exceptionClass: 'TypeError',
                  exceptionMessage:
                    "Cannot read properties of undefined (reading 'label')",
                  failingObjectType: 'object',
                  objectKeys: [
                    'actionProposals',
                    'recommendations',
                    'runtimeResponse',
                  ],
                  missingKeys: [],
                  missingProperty: 'label',
                  timestamp: '2026-08-04T12:00:00.000Z',
                },
                timestamp: '2026-08-04T12:00:00.000Z',
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(await screen.findByText('Workspace AI Experience')).toBeTruthy()
    expect(
      screen.getAllByText('buildOperationalIntelligence').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/Cannot read properties of undefined/)).toBeTruthy()
    expect(screen.getAllByText('label').length).toBeGreaterThan(0)
    expect(
      screen.getByText('actionProposals, recommendations, runtimeResponse'),
    ).toBeTruthy()
    expect(
      screen.getByText('lib/ai/operational/operationalIntelligence.ts:399'),
    ).toBeTruthy()
  })

  it('renders Workspace Reasoning Engine developer inspection sections', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                confidence: 'high',
                summary: {
                  title: 'Workspace answer',
                  summary: 'The clean response remains readable.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [
                  {
                    id: 'runtime-event-1',
                    type: 'ReasoningPrepared',
                    requestId: 'request-1',
                    createdAt: '2026-08-04T12:00:00.000Z',
                    metadata: { evidenceCount: 2 },
                  },
                ],
                investigationGoal:
                  'Determine root causes using deterministic evidence.',
                investigationPlan: [
                  { order: 1, title: 'Review Scheduling Knowledge evidence.' },
                ],
                evidence: [
                  {
                    id: 'evidence-1',
                    label: 'Scheduling snapshot',
                    verified: true,
                  },
                ],
                evidenceGroups: [
                  { domain: 'scheduling', evidenceIds: ['evidence-1'] },
                ],
                businessRules: [{ rule: 'Manager approval required.' }],
                contradictions: [],
                missingData: [{ label: 'Google Ads CPA is missing.' }],
                reasoningChain: [
                  { finding: 'Evidence supports the response.' },
                ],
                rootCauseRanking: [
                  { rank: 1, cause: 'Missing provider data', score: 82 },
                ],
                recommendationRanking: [
                  { rank: 1, recommendation: 'Review missing data.' },
                ],
                proposalCandidates: [],
                coverageReport: { inspectedDomains: ['scheduling'] },
                confidenceReport: { overall: 'high', score: 90 },
                learningOpportunities: [],
                reasoningSnapshot: {
                  id: 'reasoning-snapshot:request-1',
                  immutable: true,
                },
                operationalInsights: [{ title: 'Scheduling signal detected' }],
                decisionExplanation: [
                  { recommendation: 'Review scheduling workload' },
                ],
                businessRulesApplied: [{ rule: 'Manager approval required.' }],
                rejectedAlternatives: [],
                evidenceRanking: [{ rank: 1, evidenceId: 'evidence-1' }],
                knowledgeEffectiveness: [
                  { label: 'Manager approval required.', timesUsed: 1 },
                ],
                insightGeneration: { generatedCount: 1, executedActions: 0 },
                recommendationJustification: [
                  { recommendationId: 'recommendation-1' },
                ],
                operationalHealth: [
                  { label: 'Scheduling Health', status: 'healthy' },
                ],
                futureDashboardSignals: {
                  topPriority: { label: 'Top Priority', status: 'healthy' },
                },
                operationalHistory: { persisted: false, insightCount: 1 },
                operationalTrends: [
                  { direction: 'UNKNOWN', metric: 'Scheduling Health' },
                ],
                insightLifecycle: [{ status: 'NEW', occurrenceCount: 1 }],
                recurringRisks: [],
                recommendationOutcomes: [],
                dashboardSignals: [{ label: 'Scheduling Health' }],
                operationalTimeline: [
                  { event: 'NEW', summary: 'Scheduling signal detected' },
                ],
                healthEvolution: { trendDirection: 'STABLE' },
                trendGraphData: [{ key: 'schedulingHealth', points: [] }],
                operationalConfidence: {
                  level: 'high',
                  evidenceCount: 1,
                  trendCount: 1,
                  recurringRiskCount: 0,
                },
                operationalIntelligence: {
                  id: 'operational-intelligence:response-1',
                  deterministic: true,
                },
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))
    expect(
      await screen.findAllByText('The clean response remains readable.'),
    ).toHaveLength(2)
    await user.click(
      screen.getByRole('button', { name: /developer inspection/i }),
    )

    expect(screen.getByText('Investigation Goal')).toBeTruthy()
    expect(screen.getByText('Evidence Groups')).toBeTruthy()
    expect(screen.getByText('Business Rules')).toBeTruthy()
    expect(screen.getByText('Reasoning Chain')).toBeTruthy()
    expect(screen.getByText('Root Cause Ranking')).toBeTruthy()
    expect(screen.getByText('Recommendation Ranking')).toBeTruthy()
    expect(screen.getByText('Proposal Candidates')).toBeTruthy()
    expect(screen.getByText('Coverage Report')).toBeTruthy()
    expect(screen.getByText('Confidence Report')).toBeTruthy()
    expect(screen.getByText('Learning Opportunities')).toBeTruthy()
    expect(screen.getByText('Reasoning Snapshot')).toBeTruthy()
    expect(screen.getByText('Operational Insights')).toBeTruthy()
    expect(screen.getByText('Decision Explanation')).toBeTruthy()
    expect(screen.getByText('Business Rules Applied')).toBeTruthy()
    expect(screen.getByText('Rejected Alternatives')).toBeTruthy()
    expect(screen.getByText('Evidence Ranking')).toBeTruthy()
    expect(screen.getByText('Knowledge Effectiveness')).toBeTruthy()
    expect(screen.getByText('Insight Generation')).toBeTruthy()
    expect(screen.getByText('Recommendation Justification')).toBeTruthy()
    expect(screen.getByText('Operational Health')).toBeTruthy()
    expect(screen.getByText('Future Dashboard Signals')).toBeTruthy()
    expect(screen.getByText('Operational History')).toBeTruthy()
    expect(screen.getByText('Operational Trends')).toBeTruthy()
    expect(screen.getByText('Insight Lifecycle')).toBeTruthy()
    expect(screen.getByText('Recurring Risks')).toBeTruthy()
    expect(screen.getByText('Recommendation Outcomes')).toBeTruthy()
    expect(screen.getByText('Dashboard Signals')).toBeTruthy()
    expect(screen.getByText('Operational Timeline')).toBeTruthy()
    expect(screen.getByText('Health Evolution')).toBeTruthy()
    expect(screen.getByText('Trend Graph Data')).toBeTruthy()
    expect(screen.getByText('Operational Confidence')).toBeTruthy()
    expect(screen.getByText('ReasoningPrepared')).toBeTruthy()
  })

  it('formats deterministic 0-100 recommendation scores without multiplying by 100', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[1],
              response: {
                responseKind: 'recommendation',
                confidence: 'high',
                recommendations: [
                  {
                    id: 'recommendation-member-corbin',
                    candidateId: 'member-corbin',
                    label: 'Corbin Wesche',
                    score: 90,
                    confidence: 'high',
                    provenance: {
                      sourceProviderId: 'scheduling',
                      sourceEngine: 'Scheduling Knowledge',
                      deterministic: true,
                      scoreScale: '0-100',
                    },
                  },
                ],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [
                  {
                    id: 'runtime-event-1',
                    type: 'AIProviderInvoked',
                    requestId: 'request-1',
                    createdAt: '2026-07-30T14:00:00.000Z',
                    metadata: { providerId: 'openai-generation' },
                  },
                ],
                providerVerification: {
                  selectedProviderId: 'openai',
                  selectedProviderLabel: 'OpenAI',
                  selectedRuntimeProviderId: 'openai-generation',
                  invoked: true,
                  invokedProviderId: 'openai-generation',
                  aiRole: 'Structured explanation/response generation',
                  validationStatus: 'valid',
                  recommendationSource: {
                    sourceProviderId: 'scheduling',
                    sourceEngine: 'Scheduling Knowledge',
                    deterministic: true,
                    scoreScale: '0-100',
                  },
                },
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.selectOptions(screen.getByLabelText(/provider/i), 'openai')
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(await screen.findByText('Corbin Wesche')).toBeTruthy()
    expect(screen.getByText('Score 90%')).toBeTruthy()
    expect(screen.queryByText('Score 9000%')).toBeNull()
    expect(screen.getAllByText('Scheduling Knowledge').length).toBeGreaterThan(
      0,
    )
    await user.click(
      screen.getByRole('button', { name: /developer inspection/i }),
    )
    expect(screen.getByText('openai-generation')).toBeTruthy()
  })

  it('renders recommendation empty state without hiding provider inspection', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                responseKind: 'recommendation',
                confidence: 'low',
                summary: {
                  title: 'Technician Recommendation',
                  summary:
                    'No eligible members were found for this recommendation.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
                providerVerification: {
                  selectedProviderId: 'mock',
                  selectedProviderLabel: 'Mock',
                  selectedRuntimeProviderId: 'mock-ai-provider',
                  invoked: false,
                  aiRole: 'No provider invocation',
                  validationStatus: 'valid',
                  recommendationSource: {
                    sourceProviderId: 'scheduling',
                    sourceEngine: 'Scheduling Knowledge',
                    deterministic: true,
                    scoreScale: '0-100',
                  },
                },
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(
      await screen.findAllByText(
        'No eligible members were found for this recommendation.',
      ),
    ).toHaveLength(2)
    expect(screen.getByText('No recommendation candidate found')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: /developer inspection/i }),
    )
    expect(screen.getByText('Provider verification')).toBeTruthy()
    expect(screen.getByText('Not invoked')).toBeTruthy()
  })

  it('switches to the CRM domain and sends CRM intent payloads', async () => {
    const user = userEvent.setup()
    let submittedBody = ''
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      submittedBody = String(init?.body ?? '')
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            provider: playgroundProps.providerOptions[0],
            response: {
              responseKind: 'recommendations',
              confidence: 'medium',
              summary: {
                title: 'Lead Prioritization',
                summary: 'CRM deterministic facts were inspected.',
              },
              recommendations: [
                {
                  id: 'crm-recommendation-1',
                  subject: {
                    id: 'lead-1',
                    type: 'lead',
                    label: 'Riley Carter',
                  },
                  score: 82,
                  confidence: 'high',
                  provenance: {
                    sourceProviderId: 'crm',
                    sourceEngine: 'CRM Knowledge Provider',
                    deterministic: true,
                    scoreScale: '0-100',
                  },
                },
              ],
              actionProposals: [],
              decisionProposals: [],
            },
            inspection: {
              actionExecution: 'not-executed',
              runtimeEvents: [],
              recommendationSource: {
                sourceProviderId: 'crm',
                sourceEngine: 'CRM Knowledge Provider',
                deterministic: true,
                scoreScale: '0-100',
              },
              providerVerification: {
                selectedProviderId: 'mock',
                selectedProviderLabel: 'Mock',
                selectedRuntimeProviderId: 'mock-ai-provider',
                invoked: true,
                invokedProviderId: 'mock-ai-provider',
                aiRole: 'Structured explanation/response generation',
                validationStatus: 'valid',
                recommendationSource: {
                  sourceProviderId: 'crm',
                  sourceEngine: 'CRM Knowledge Provider',
                  deterministic: true,
                  scoreScale: '0-100',
                },
              },
            },
          }),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.selectOptions(screen.getByLabelText(/domain/i), 'crm')
    expect(screen.getByText('CRM AI playground')).toBeTruthy()
    expect(screen.getByLabelText('Lead')).toBeTruthy()
    expect(screen.getByLabelText('Opportunity')).toBeTruthy()
    expect(screen.getByLabelText('Client')).toBeTruthy()
    expect(screen.getByLabelText('Owner')).toBeTruthy()
    expect(screen.getByLabelText(/auto-detect intent/i)).toBeTruthy()
    await user.click(screen.getByLabelText(/force intent for testing/i))
    expect(
      screen.getByRole('option', { name: 'Lead Prioritization' }),
    ).toBeTruthy()
    expect(screen.queryByText('Request an action proposal')).toBeNull()
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(await screen.findByText('Riley Carter')).toBeTruthy()
    expect(
      screen.getAllByText('CRM Knowledge Provider').length,
    ).toBeGreaterThan(0)
    const body = JSON.parse(submittedBody)
    expect(body).toMatchObject({
      domainId: 'crm',
      routingMode: 'FORCE_INTENT',
      intent: 'prioritizeLeads',
      includeActionProposal: false,
    })
  })

  it('promotes structured answers and follow-up suggestions without showing raw JSON first', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[1],
              response: {
                intent: 'analyzeSchedule',
                confidence: 'high',
                workspaceAIResponse: {
                  answer: {
                    summary:
                      'OpenAI explained the deterministic workspace facts.',
                    details: ['No conflicts were found in the selected range.'],
                  },
                  followUpSuggestions: ['Show overloaded technicians'],
                  runtimeResponse: {
                    structuredResponse: {
                      answer: {
                        summary: 'Structured fallback should not be visible.',
                      },
                    },
                  },
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
                providerVerification: {
                  selectedProviderId: 'openai',
                  selectedProviderLabel: 'OpenAI',
                  selectedRuntimeProviderId: 'openai-generation',
                  invoked: true,
                  invokedProviderId: 'openai-generation',
                  aiRole: 'Structured explanation/response generation',
                  validationStatus: 'valid',
                  recommendationSource: {
                    sourceProviderId: 'scheduling',
                    sourceEngine: 'Scheduling Knowledge',
                    deterministic: true,
                    scoreScale: '0-100',
                  },
                },
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.selectOptions(screen.getByLabelText(/provider/i), 'openai')
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(
      await screen.findAllByText(
        'OpenAI explained the deterministic workspace facts.',
      ),
    ).toHaveLength(2)
    expect(
      screen.getByText('No conflicts were found in the selected range.'),
    ).toBeTruthy()
    expect(screen.queryByText('Sanitized JSON')).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Show overloaded technicians' }),
    )
    expect(
      (screen.getByLabelText(/ask a follow-up/i) as HTMLTextAreaElement).value,
    ).toBe('Show overloaded technicians')
    expect(
      screen.getAllByText(
        'OpenAI explained the deterministic workspace facts.',
      ),
    ).toHaveLength(2)
  })

  it('sends follow-up turns with concise prior context and clears the thread on Start new test', async () => {
    const user = userEvent.setup()
    const submittedBodies: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        submittedBodies.push(JSON.parse(String(init?.body ?? '{}')))
        const isFollowUp = submittedBodies.length > 1
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                routedIntent: 'workspace.investigate',
                intent: 'investigateWorkspace',
                confidence: 'high',
                summary: {
                  title: 'Schedule summary',
                  summary: isFollowUp
                    ? 'The highest-priority conflict is the selected assignment.'
                    : 'The current schedule has one conflict.',
                },
                references: [{ id: 'workspace-ai-reference:conflict-1' }],
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        })
      }),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))
    expect(
      await screen.findAllByText('The current schedule has one conflict.'),
    ).toHaveLength(2)

    await user.type(
      screen.getByLabelText(/ask a follow-up/i),
      'Which conflict should I fix first?',
    )
    await user.click(screen.getByRole('button', { name: /send follow-up/i }))

    expect(
      await screen.findAllByText(
        'The highest-priority conflict is the selected assignment.',
      ),
    ).toHaveLength(2)
    expect(submittedBodies[1].conversation.priorTurns[0]).toMatchObject({
      domain: 'workspace',
      intent: 'investigateWorkspace',
      prompt: expect.stringContaining('Summarize my schedule.'),
      responseSummary: 'The current schedule has one conflict.',
      referenceIds: ['workspace-ai-reference:conflict-1'],
    })
    expect(JSON.stringify(submittedBodies[1].conversation)).not.toContain(
      'runtimeEvents',
    )
    expect(screen.getByText('Which conflict should I fix first?')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /start new test/i }))
    expect(screen.queryByText('Which conflict should I fix first?')).toBeNull()
  })

  it('renders concrete proposal previews and expandable review details', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                responseKind: 'actionProposal',
                confidence: 'high',
                summary: {
                  title: 'Technician Recommendation',
                  summary:
                    'A concrete assignment proposal is ready for review.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [
                  {
                    id: 'proposal-1',
                    actionType: 'assignTechnician',
                    label: 'Assign Dana Kim to Pinecrest Offices',
                    summary:
                      'Prepare an approval-required assignment change for Pinecrest Offices using Dana Kim.',
                    target: {
                      recordType: 'schedulingEvent',
                      recordId: 'event-pinecrest',
                      label: 'Pinecrest Offices',
                      detail: 'August 5, 2026 at 12:00 PM',
                    },
                    currentState: 'Unassigned',
                    proposedState: 'Assign to Dana Kim',
                    reasonCodes: ['available', 'lower-workload'],
                    explanation:
                      'Dana is available and has lower workload than other qualified technicians.',
                    expectedImpact: ['Resolves one unassigned appointment.'],
                    validation: {
                      status: 'valid',
                      message:
                        'Ready for internal proposal review. Execution remains disabled.',
                    },
                    approval: { status: 'pending' },
                    executionBoundary: 'proposal-only',
                    confidence: 'high',
                    references: [],
                  },
                ],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByLabelText(/request an action proposal/i))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(
      await screen.findByText('Assign Dana Kim to Pinecrest Offices'),
    ).toBeTruthy()
    expect(screen.getByText('Target: Pinecrest Offices')).toBeTruthy()
    expect(screen.getByText('Proposed change: Assign to Dana Kim')).toBeTruthy()
    expect(screen.getByText('Approval required')).toBeTruthy()
    expect(screen.getByText('Not executed')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /review proposal/i }))
    expect(screen.getByText('Current state:')).toBeTruthy()
    expect(screen.getByText('Unassigned')).toBeTruthy()
    expect(
      screen.getByText('Resolves one unassigned appointment.'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Execution is not enabled in the Internal AI Playground.',
      ),
    ).toBeTruthy()
  })

  it('renders coordinated proposal plans separately from independent proposals', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                responseKind: 'actionProposal',
                confidence: 'high',
                summary: {
                  title: 'Scheduling plan',
                  summary: 'A coordinated scheduling plan is ready for review.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                actionProposalPlans: [
                  {
                    id: 'plan-1',
                    title: 'Resolve Pinecrest Offices scheduling conflict',
                    objective:
                      'Move the appointment, assign a qualified technician, and prepare a customer notification review.',
                    targetRecordIds: ['event-pinecrest'],
                    expectedImpact: [
                      'Resolves the conflict without executing changes from the Playground.',
                    ],
                    warnings: [
                      'Customer notification delivery is not executed in the Playground.',
                    ],
                    riskLevel: 'low',
                    approvalMode: 'required',
                    executionStatus: 'not-executed',
                    validation: { status: 'valid' },
                    steps: [
                      {
                        id: 'step-1',
                        order: 1,
                        actionType: 'moveAppointment',
                        target: { label: 'Pinecrest Offices' },
                        currentState: 'Scheduled at 12:00 PM',
                        proposedState: 'Move to 1:30 PM',
                        reason:
                          'The proposed slot avoids the time-off overlap.',
                        dependencies: [],
                        approvalStatus: 'pending',
                        executionStatus: 'not-executed',
                      },
                    ],
                  },
                ],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(await screen.findByText('Proposal Plans')).toBeTruthy()
    expect(screen.getByText('Coordinated plan')).toBeTruthy()
    expect(
      screen.getByText('Resolve Pinecrest Offices scheduling conflict'),
    ).toBeTruthy()
    expect(screen.getByText('1 step')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /review plan/i }))
    expect(screen.getByText('1. moveAppointment')).toBeTruthy()
    expect(screen.getByText('Target: Pinecrest Offices')).toBeTruthy()
    expect(screen.getByText('Move to 1:30 PM')).toBeTruthy()
    expect(
      screen.getByText(
        'Execution is not enabled in the Internal AI Playground.',
      ),
    ).toBeTruthy()
  })

  it('shows a no-proposal state when an action proposal was requested but none returned', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                intent: 'recommendTechnician',
                responseKind: 'recommendation',
                confidence: 'medium',
                actionProposalRequested: true,
                summary: {
                  title: 'Technician Recommendation',
                  summary: 'A recommendation was returned without a proposal.',
                },
                recommendations: [],
                actionProposals: undefined,
                actionProposalPlans: undefined,
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))

    expect(await screen.findByText('Action Proposals')).toBeTruthy()
    expect(screen.getByText('No proposal available.')).toBeTruthy()
  })

  it('clears stale responses when provider, intent, or context changes', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              provider: playgroundProps.providerOptions[0],
              response: {
                confidence: 'high',
                summary: {
                  title: 'Schedule summary',
                  summary: 'A stale response should clear.',
                },
                recommendations: [],
                explanations: [],
                actionProposals: [],
                decisionProposals: [],
              },
              inspection: {
                actionExecution: 'not-executed',
                runtimeEvents: [],
              },
            }),
        }),
      ),
    )

    render(React.createElement(InternalAIPlayground, playgroundProps))
    await user.click(screen.getByRole('button', { name: /run test/i }))
    expect(
      await screen.findAllByText('A stale response should clear.'),
    ).toHaveLength(2)

    await user.selectOptions(screen.getByLabelText(/provider/i), 'openai')
    expect(screen.queryByText('A stale response should clear.')).toBeNull()

    await user.click(screen.getByRole('button', { name: /run test/i }))
    expect(
      await screen.findAllByText('A stale response should clear.'),
    ).toHaveLength(2)

    await user.click(screen.getByLabelText(/force intent for testing/i))
    await user.selectOptions(
      screen.getByLabelText(/forced intent/i),
      'analyzeWorkload',
    )
    expect(screen.queryByText('A stale response should clear.')).toBeNull()
  })
})

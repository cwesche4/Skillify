import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SchedulingAIPanel } from '@/components/scheduling/SchedulingAIPanel'
import type { SchedulingAIContextPayload } from '@/lib/ai/scheduling/customerSchedulingAI'

const eventContext: SchedulingAIContextPayload = {
  entryPoint: 'event',
  label: 'Discovery Call · Jul 30, 2:00 PM - 3:00 PM',
  references: [
    { kind: 'event', id: 'event-1', label: 'Discovery Call' },
    { kind: 'technician', id: 'member-1', label: 'Jane Smith' },
  ],
  calendar: {
    dateKey: '2026-07-30',
    rangeStart: '2026-07-30T18:00:00.000Z',
    rangeEnd: '2026-07-30T19:00:00.000Z',
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SchedulingAIPanel', () => {
  it('sends compact context references and renders customer-facing recommendation cards', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            response: {
              id: 'response-1',
              responseKind: 'recommendation',
              confidence: 'high',
              explanations: [],
              recommendations: [
                {
                  id: 'recommendation-1',
                  candidateId: 'member-1',
                  candidateType: 'member',
                  label: 'Jane Smith',
                  score: 90,
                  scoreLabel: 'Score 90%',
                  confidence: 'high',
                  provenanceLabel: 'Recommended using Skillify Scheduling data',
                  reasons: [
                    { code: 'available', label: 'Member is available.' },
                  ],
                  warnings: [],
                },
              ],
              actionProposals: [],
              decisionProposals: [],
              warnings: [],
              references: [],
              followUpSuggestions: ['Why?'],
              metadata: {
                actionExecution: 'not-executed',
              },
            },
          }),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      React.createElement(SchedulingAIPanel, {
        workspaceId: 'workspace-1',
        open: true,
        context: eventContext,
        onClose: vi.fn(),
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Who is the best available member?' }),
    )

    await waitFor(() =>
      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(
        2,
      ),
    )
    expect(screen.getAllByText('Score 90%').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText('Recommended using Skillify Scheduling data'),
    ).toBeTruthy()
    expect(screen.queryByText(/OpenAI/i)).toBeNull()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body?: string },
    ]
    const body = JSON.parse(String(init.body))
    expect(body.context.references).toEqual(eventContext.references)
    expect(JSON.stringify(body)).not.toContain('startsAt')
    expect(JSON.stringify(body)).not.toContain('assignedMemberIds')
  })

  it('shows provider-unavailable errors without crashing', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              ok: false,
              code: 'SCHEDULING_AI_PROVIDER_UNAVAILABLE',
              message:
                'Scheduling AI is not available because the AI provider is not configured.',
            }),
        }),
      ),
    )

    render(
      React.createElement(SchedulingAIPanel, {
        workspaceId: 'workspace-1',
        open: true,
        context: eventContext,
        onClose: vi.fn(),
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Who is the best available member?' }),
    )

    expect(await screen.findByText('Scheduling AI unavailable')).toBeTruthy()
    expect(screen.getByText(/AI provider is not configured/)).toBeTruthy()
  })

  it('renders conflict details and opens the source event without exposing raw timestamps', async () => {
    const user = userEvent.setup()
    const openEvent = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              response: {
                id: 'response-1',
                responseKind: 'analysis',
                confidence: 'high',
                explanations: [],
                recommendations: [],
                analysis: {
                  id: 'analysis-1',
                  title: 'Conflict analysis',
                  summary:
                    '1 active blocking conflict was analyzed for current and upcoming scheduling conflicts for the next 30 days.',
                  range: {
                    mode: 'currentUpcoming',
                    label:
                      'current and upcoming scheduling conflicts for the next 30 days',
                    startsAt: '2026-07-30T14:00:00.000Z',
                    endsAt: '2026-08-29T14:00:00.000Z',
                  },
                  conflictCounts: { total: 1, blocking: 1, informational: 0 },
                  conflicts: [
                    {
                      id: 'busy:event-1',
                      conflictType: 'busy',
                      sourceId: 'event-1',
                      sourceLabel: 'Proposal Review',
                      startsAt: '2026-07-30T15:00:00.000Z',
                      endsAt: '2026-07-30T16:00:00.000Z',
                      severity: 'blocking',
                      blocking: true,
                    },
                  ],
                  conflictDetails: [
                    {
                      id: 'detail-1',
                      title: 'Overlapping scheduled work',
                      conflictType: 'busy',
                      severity: 'blocking',
                      status: 'upcoming',
                      affectedAssigneeLabel: 'Owner',
                      sourceLabel: 'Proposal Review',
                      sourceEventId: 'event-1',
                      timeRangeLabel: 'Jul 30, 2026 · 11:00 AM-12:00 PM',
                      overlapLabel:
                        'Proposal Review overlaps Jul 30, 2026 · 11:00 AM-12:00 PM.',
                      whyItMatters:
                        'The assigned person already has blocking scheduled work during this window.',
                      recommendedAction: 'REASSIGN',
                      recommendedActionLabel: 'Reassign to Field Tech',
                      recommendationReason:
                        'Field Tech is available based on deterministic workload and availability evidence.',
                      alternativeActions: [],
                    },
                  ],
                  workload: [],
                  providerHealth: [],
                },
                actionProposals: [],
                decisionProposals: [],
                warnings: [],
                references: [],
                followUpSuggestions: [],
                metadata: { actionExecution: 'not-executed' },
              },
            }),
        }),
      ),
    )

    render(
      React.createElement(SchedulingAIPanel, {
        workspaceId: 'workspace-1',
        open: true,
        context: eventContext,
        onClose: vi.fn(),
        onOpenEvent: openEvent,
      }),
    )
    await user.type(
      screen.getByLabelText(/ask a scheduling question/i),
      'Show current conflicts',
    )
    await user.click(screen.getByRole('button', { name: 'Ask Scheduling AI' }))

    expect(await screen.findByText('Overlapping scheduled work')).toBeTruthy()
    expect(
      screen.getByText('Owner · Jul 30, 2026 · 11:00 AM-12:00 PM'),
    ).toBeTruthy()
    expect(screen.getByText('Reassign to Field Tech')).toBeTruthy()
    expect(screen.queryByText(/T15:00:00.000Z/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Open event' }))
    expect(openEvent).toHaveBeenCalledWith('event-1')
  })

  it('lets users select recommendations and review draft proposals without execution', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              response: {
                id: 'response-1',
                responseKind: 'actionProposal',
                confidence: 'high',
                explanations: [],
                recommendations: [
                  {
                    id: 'recommendation-1',
                    candidateId: 'member-1',
                    candidateType: 'member',
                    label: 'Jane Smith',
                    score: 90,
                    scoreLabel: 'Score 90%',
                    confidence: 'high',
                    provenanceLabel:
                      'Recommended using Skillify Scheduling data',
                    reasons: [
                      {
                        code: 'available',
                        label: 'Available for the requested time.',
                      },
                    ],
                    warnings: [],
                  },
                  {
                    id: 'recommendation-2',
                    candidateId: 'member-2',
                    candidateType: 'member',
                    label: 'Corbin Wesche',
                    score: 72,
                    scoreLabel: 'Score 72%',
                    confidence: 'medium',
                    provenanceLabel:
                      'Recommended using Skillify Scheduling data',
                    reasons: [],
                    warnings: [
                      {
                        code: 'overloaded',
                        label: 'Higher workload.',
                        severity: 'warning',
                      },
                    ],
                  },
                ],
                actionProposals: [
                  {
                    id: 'proposal-1',
                    actionType: 'createEventAndAssign',
                    label: 'Draft Emergency Service with Jane Smith',
                    proposedState:
                      'Create Emergency Service\\nTechnician: Jane Smith',
                    validation: { status: 'valid' },
                  },
                ],
                decisionProposals: [],
                warnings: [],
                references: [],
                followUpSuggestions: [],
                metadata: { actionExecution: 'not-executed' },
              },
            }),
        }),
      ),
    )

    render(
      React.createElement(SchedulingAIPanel, {
        workspaceId: 'workspace-1',
        open: true,
        context: eventContext,
        onClose: vi.fn(),
      }),
    )
    await user.type(
      screen.getByLabelText(/ask a scheduling question/i),
      'Schedule emergency service tomorrow at 10 PM and assign the best technician',
    )
    await user.click(screen.getByRole('button', { name: 'Ask Scheduling AI' }))

    expect(await screen.findByText('Selected candidate')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Corbin Wesche/i }))
    expect(
      screen.getByText(
        'Compare candidates by selecting another card. Scores are deterministic and based on available evidence.',
      ),
    ).toBeTruthy()
    expect(screen.getByText(/Create Emergency Service/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review draft' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })
})

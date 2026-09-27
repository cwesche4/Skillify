import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRecurringServiceWorkflow } from '@/lib/recurring-services/client'

const serviceInput = {
  name: 'Weekly Lawn Care',
  description: null,
  serviceInstructions: 'Use side gate.',
  pricePerVisitCents: 6500,
  currency: 'USD',
  defaultJobPriority: 'NORMAL' as const,
  defaultSteps: [
    { title: 'Mow', description: null },
    { title: 'Edge', description: null },
  ],
}

const scheduleInput = {
  title: 'Weekly Lawn Care',
  startsAt: '2026-09-28T13:00:00.000Z',
  endsAt: '2026-09-28T14:00:00.000Z',
  timezone: 'America/New_York',
  locationType: 'toBeDetermined' as const,
  assignedMemberIds: ['member-1'],
  assignments: [
    { assignmentType: 'MEMBER' as const, workspaceMemberId: 'member-1' },
    { assignmentType: 'TEAM' as const, teamId: 'team-1' },
  ],
  recurrenceRule: {
    frequency: 'weekly' as const,
    interval: 1,
    daysOfWeek: [1, 3, 5],
    endType: 'never' as const,
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('Recurring Service create workflow', () => {
  it('creates Scheduling first and links the returned series without losing inputs', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            event: {
              id: 'event-1',
              recurrenceSeriesId: 'series-1',
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ recurringService: { id: 'service-1' } }),
          {
            status: 201,
          },
        ),
      )
    vi.stubGlobal('fetch', fetch)

    await createRecurringServiceWorkflow({
      workspaceId: 'ws-1',
      customerId: 'customer-1',
      serviceInput,
      scheduleInput,
    })

    const scheduleBody = JSON.parse(fetch.mock.calls[0][1].body as string)
    expect(scheduleBody.event.recurrenceRule.daysOfWeek).toEqual([1, 3, 5])
    expect(scheduleBody.event.assignments).toEqual(scheduleInput.assignments)
    expect(scheduleBody.event.locationType).toBe('toBeDetermined')
    const serviceBody = JSON.parse(fetch.mock.calls[1][1].body as string)
    expect(serviceBody.recurrenceSeriesId).toBe('series-1')
    expect(
      serviceBody.defaultSteps.map((step: { title: string }) => step.title),
    ).toEqual(['Mow', 'Edge'])
  })

  it('compensates through the supported entire-series delete after link failure', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            event: { id: 'event-1', recurrenceSeriesId: 'series-1' },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Customer changed.' }), {
          status: 409,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetch)

    await expect(
      createRecurringServiceWorkflow({
        workspaceId: 'ws-1',
        customerId: 'customer-1',
        serviceInput,
        scheduleInput,
      }),
    ).rejects.toThrow('The incomplete schedule was removed.')
    expect(fetch.mock.calls[2][0]).toContain('/scheduling/events/event-1')
    expect(JSON.parse(fetch.mock.calls[2][1].body as string)).toEqual({
      scope: 'entireSeries',
    })
  })
})

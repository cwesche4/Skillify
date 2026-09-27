import { describe, expect, it } from 'vitest'

import type { RecurringServiceClientRecord } from '@/lib/recurring-services/clientTypes'
import {
  boundedUpcomingJobs,
  formatRecurringServiceCadence,
  recurringServiceAssignmentLabel,
  recurringServiceStatusLabels,
} from '@/lib/recurring-services/presentation'

function service(
  assignments: RecurringServiceClientRecord['recurrenceSeries'] extends infer T
    ? T extends { masterEvent: { assignments: infer A } }
      ? A
      : never
    : never,
): RecurringServiceClientRecord {
  return {
    id: 'service-1',
    workspaceId: 'ws-1',
    customerId: 'customer-1',
    recurrenceSeriesId: 'series-1',
    name: 'Lawn care',
    description: null,
    serviceInstructions: null,
    pricePerVisitCents: 6500,
    currency: 'USD',
    defaultJobPriority: 'NORMAL',
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    endedAt: null,
    stepTemplates: [],
    recurrenceSeries: {
      id: 'series-1',
      status: 'ACTIVE',
      version: 1,
      timezone: 'America/New_York',
      normalizedRule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        endType: 'never',
      },
      localStartDate: '2026-09-28',
      localStartTime: '09:00',
      durationMinutes: 60,
      masterEvent: {
        id: 'event-1',
        title: 'Lawn care',
        startsAtUtc: '2026-09-28T13:00:00.000Z',
        endsAtUtc: '2026-09-28T14:00:00.000Z',
        assignments,
      },
    },
  }
}

describe('Recurring Service presentation', () => {
  it('presents lifecycle status and cadence in plain language', () => {
    expect(recurringServiceStatusLabels).toEqual({
      ACTIVE: 'Active',
      PAUSED: 'Paused',
      ENDED: 'Ended',
    })
    expect(
      formatRecurringServiceCadence({
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        endType: 'never',
      }),
    ).toBe('Every week · Mon, Wed, Fri')
  })

  it('truthfully presents mixed member and Team assignments', () => {
    const record = service([
      {
        id: 'assignment-1',
        assignmentType: 'MEMBER',
        workspaceMemberId: 'member-1',
        teamId: null,
        roleLabel: null,
        displaySnapshot: 'Avery',
      },
      {
        id: 'assignment-2',
        assignmentType: 'TEAM',
        workspaceMemberId: null,
        teamId: 'team-1',
        roleLabel: null,
        displaySnapshot: 'Crew One',
      },
    ])
    expect(
      recurringServiceAssignmentLabel(
        record,
        new Map([['member-1', 'Avery']]),
        new Map([['team-1', 'Crew One']]),
      ),
    ).toBe('Avery, Crew One')
  })

  it('bounds upcoming Jobs without cutting the final operational week', () => {
    const start = new Date('2026-09-28T13:00:00.000Z')
    const jobs = Array.from({ length: 20 }, (_, index) => {
      const date = new Date(start)
      date.setUTCDate(date.getUTCDate() + index)
      return {
        id: `job-${index + 1}`,
        title: `Visit ${index + 1}`,
        status: 'SCHEDULED',
        priority: 'NORMAL',
        scheduledStartAt: date.toISOString(),
        scheduledEndAt: new Date(date.getTime() + 3_600_000).toISOString(),
        completedAt: null,
        valueCents: 6500,
        currency: 'USD',
        assignments: [],
      }
    })
    const visible = boundedUpcomingJobs(
      jobs,
      12,
      new Date('2026-09-27T00:00:00.000Z'),
    )
    expect(visible).toHaveLength(14)
    expect(visible.at(-1)?.scheduledStartAt).toContain('2026-10-11')
    expect(jobs).toHaveLength(20)
  })
})

import { describe, expect, it } from 'vitest'

import {
  generateRecurrenceOccurrences,
  normalizeSchedulingRecurrenceRule,
} from '@/lib/scheduling/recurrence'
import {
  getAllowedRecurrenceScopes,
  shouldPromptForRecurrenceScope,
} from '@/lib/scheduling/recurrenceScope'
import { getSchedulingOccurrencesForRange } from '@/lib/scheduling/schedulingCalendar'
import type { SchedulingEvent } from '@/lib/scheduling/types'

const baseEvent: SchedulingEvent = {
  id: 'event_1',
  workspaceId: 'workspace_1',
  title: 'Recurring visit',
  type: 'recurringServiceVisit',
  status: 'scheduled',
  startsAt: '2026-07-27T13:00:00.000Z',
  endsAt: '2026-07-27T14:00:00.000Z',
  allDay: false,
  timezone: 'America/New_York',
  assignedMemberIds: ['member_1'],
  externalCalendarState: 'notConnected',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

describe('scheduling recurrence materialization helpers', () => {
  it('normalizes weekly recurrence into a stable RRULE and summary', () => {
    const recurrence = normalizeSchedulingRecurrenceRule({
      rule: {
        frequency: 'weekly',
        interval: 2,
        daysOfWeek: [3, 1, 1],
        endType: 'afterOccurrences',
        occurrenceCount: 4,
      },
      startsAt: '2026-07-27T13:00:00.000Z',
      endsAt: '2026-07-27T14:00:00.000Z',
      timezone: 'America/New_York',
    })

    expect(recurrence.rule.daysOfWeek).toEqual([1, 3])
    expect(recurrence.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4')
    expect(recurrence.summary).toBe(
      'Every 2 weeks on Monday, Wednesday for 4 occurrences',
    )
    expect(recurrence.localStartDate).toBe('2026-07-27')
    expect(recurrence.localStartTime).toBe('09:00')
    expect(recurrence.durationMinutes).toBe(60)
  })

  it('generates timezone-safe weekly occurrences across daylight saving time', () => {
    const recurrence = normalizeSchedulingRecurrenceRule({
      rule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [0],
        endType: 'afterOccurrences',
        occurrenceCount: 3,
      },
      startsAt: '2026-10-25T13:00:00.000Z',
      endsAt: '2026-10-25T14:00:00.000Z',
      timezone: 'America/New_York',
    })

    const occurrences = generateRecurrenceOccurrences({
      recurrence,
      rangeStart: new Date('2026-10-25T00:00:00.000Z'),
      rangeEnd: new Date('2026-11-15T23:59:59.999Z'),
    })

    expect(occurrences.map((item) => item.localDate)).toEqual([
      '2026-10-25',
      '2026-11-01',
      '2026-11-08',
    ])
    expect(occurrences.map((item) => item.startsAtUtc.toISOString())).toEqual([
      '2026-10-25T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
      '2026-11-08T14:00:00.000Z',
    ])
  })

  it('honors occurrence count and on-date end controls', () => {
    const counted = normalizeSchedulingRecurrenceRule({
      rule: {
        frequency: 'daily',
        interval: 1,
        endType: 'afterOccurrences',
        occurrenceCount: 2,
      },
      startsAt: baseEvent.startsAt,
      endsAt: baseEvent.endsAt,
      timezone: baseEvent.timezone,
    })
    expect(
      generateRecurrenceOccurrences({
        recurrence: counted,
        rangeStart: new Date('2026-07-01T00:00:00.000Z'),
        rangeEnd: new Date('2026-08-31T23:59:59.999Z'),
      }).map((item) => item.localDate),
    ).toEqual(['2026-07-27', '2026-07-28'])

    const until = normalizeSchedulingRecurrenceRule({
      rule: {
        frequency: 'monthly',
        interval: 1,
        endType: 'onDate',
        endDate: '2026-09-30',
      },
      startsAt: baseEvent.startsAt,
      endsAt: baseEvent.endsAt,
      timezone: baseEvent.timezone,
    })
    expect(
      generateRecurrenceOccurrences({
        recurrence: until,
        rangeStart: new Date('2026-07-01T00:00:00.000Z'),
        rangeEnd: new Date('2026-12-31T23:59:59.999Z'),
      }).map((item) => item.localDate),
    ).toEqual(['2026-07-27', '2026-08-27', '2026-09-27'])
  })

  it('treats persisted generated rows as recurring occurrences without expanding them again', () => {
    const occurrence: SchedulingEvent = {
      ...baseEvent,
      id: 'occurrence_1',
      recurrenceSeriesId: 'series_1',
      sourceEventId: 'master_1',
      occurrenceOriginalAt: baseEvent.startsAt,
      occurrenceState: 'generated',
      recurrenceRule: undefined,
    }
    const master: SchedulingEvent = {
      ...baseEvent,
      id: 'master_1',
      recurrenceSeriesId: 'series_1',
      occurrenceState: 'master',
      recurrenceRule: {
        frequency: 'daily',
        interval: 1,
        endType: 'never',
      },
    }

    const occurrences = getSchedulingOccurrencesForRange({
      events: [master, occurrence],
      rangeStart: new Date('2026-07-27T00:00:00.000Z'),
      rangeEnd: new Date('2026-07-28T23:59:59.999Z'),
    })

    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].id).toBe('occurrence_1')
    expect(occurrences[0].sourceEventId).toBe('master_1')
    expect(occurrences[0].isRecurringOccurrence).toBe(true)
  })

  it('excludes canceled and deleted materialized occurrences from calendar ranges', () => {
    const canceled: SchedulingEvent = {
      ...baseEvent,
      id: 'occurrence_canceled',
      recurrenceSeriesId: 'series_1',
      occurrenceOriginalAt: baseEvent.startsAt,
      occurrenceState: 'canceled',
    }
    const deleted: SchedulingEvent = {
      ...baseEvent,
      id: 'occurrence_deleted',
      recurrenceSeriesId: 'series_1',
      occurrenceOriginalAt: baseEvent.startsAt,
      occurrenceState: 'deleted',
    }

    expect(
      getSchedulingOccurrencesForRange({
        events: [canceled, deleted],
        rangeStart: new Date('2026-07-27T00:00:00.000Z'),
        rangeEnd: new Date('2026-07-28T23:59:59.999Z'),
      }),
    ).toEqual([])
  })

  it('centralizes recurrence action scope rules for recurring occurrences', () => {
    const occurrence: SchedulingEvent = {
      ...baseEvent,
      id: 'occurrence_1',
      recurrenceSeriesId: 'series_1',
      sourceEventId: 'master_1',
      occurrenceOriginalAt: baseEvent.startsAt,
      occurrenceState: 'generated',
    }

    expect(getAllowedRecurrenceScopes({ action: 'edit', occurrence })).toEqual([
      'thisOccurrence',
      'thisAndFollowing',
      'entireSeries',
    ])
    expect(
      getAllowedRecurrenceScopes({ action: 'delete', occurrence }),
    ).toEqual(['thisOccurrence', 'thisAndFollowing', 'entireSeries'])
    expect(
      getAllowedRecurrenceScopes({ action: 'cancel', occurrence }),
    ).toEqual(['thisOccurrence', 'thisAndFollowing', 'entireSeries'])
    expect(
      getAllowedRecurrenceScopes({ action: 'complete', occurrence }),
    ).toEqual(['thisOccurrence'])
    expect(shouldPromptForRecurrenceScope({ action: 'edit', occurrence })).toBe(
      true,
    )
    expect(
      shouldPromptForRecurrenceScope({ action: 'complete', occurrence }),
    ).toBe(false)
  })

  it('does not prompt for scope on one-time events', () => {
    expect(
      getAllowedRecurrenceScopes({
        action: 'edit',
        occurrence: baseEvent,
      }),
    ).toEqual([])
    expect(
      shouldPromptForRecurrenceScope({
        action: 'delete',
        occurrence: baseEvent,
      }),
    ).toBe(false)
  })
})

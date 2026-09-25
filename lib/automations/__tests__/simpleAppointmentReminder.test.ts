import { describe, expect, it } from 'vitest'

import {
  appointmentReminderEventKey,
  appointmentReminderMetadataSchema,
  buildAppointmentReminderScheduleRevision,
  getAppointmentReminderOffsetMinutes,
  isAppointmentReminderEventType,
  isAppointmentReminderOccurrenceStateEligible,
} from '@/lib/automations/simpleAppointmentReminder'

describe('native Appointment Reminder identity and eligibility', () => {
  it.each([
    'serviceAppointment',
    'estimate',
    'siteVisit',
    'discoveryCall',
    'consultation',
    'installationAppointment',
    'productDemonstration',
  ])('includes appointment-section type %s', (eventType) => {
    expect(isAppointmentReminderEventType(eventType)).toBe(true)
  })

  it.each([
    'scheduledJob',
    'recurringServiceVisit',
    'internalMeeting',
    'blockedTime',
    'customerPickup',
    'deliveryWindow',
    'recurringDelivery',
  ])('excludes non-appointment type %s', (eventType) => {
    expect(isAppointmentReminderEventType(eventType)).toBe(false)
  })

  it.each([
    ['15-minutes', 15],
    ['30-minutes', 30],
    ['1-hour', 60],
    ['1-day', 1440],
  ])('maps %s to %i minutes', (value, minutes) => {
    expect(
      getAppointmentReminderOffsetMinutes({ 'reminder-offset': value }),
    ).toBe(minutes)
  })

  it('rejects obsolete and arbitrary reminder offsets', () => {
    expect(
      getAppointmentReminderOffsetMinutes({ 'reminder-time': '24-hours' }),
    ).toBeNull()
    expect(
      getAppointmentReminderOffsetMinutes({ 'reminder-offset': '45-minutes' }),
    ).toBeNull()
  })

  it('rejects master, canceled, completed, superseded, and deleted occurrence states', () => {
    expect(isAppointmentReminderOccurrenceStateEligible(null)).toBe(true)
    expect(isAppointmentReminderOccurrenceStateEligible('GENERATED')).toBe(
      true,
    )
    expect(isAppointmentReminderOccurrenceStateEligible('OVERRIDDEN')).toBe(
      true,
    )
    for (const state of [
      'MASTER',
      'CANCELED',
      'COMPLETED',
      'SUPERSEDED',
      'DELETED',
    ]) {
      expect(isAppointmentReminderOccurrenceStateEligible(state)).toBe(false)
    }
  })

  it('keeps retries stable while distinguishing reschedules and occurrences', () => {
    const base = {
      installationId: 'installation-1',
      eventId: 'occurrence-1',
      eventStartsAtUtc: new Date('2026-10-01T14:00:00.000Z'),
      occurrenceOriginalAt: new Date('2026-10-01T14:00:00.000Z'),
      offsetMinutes: 60,
    }
    const revision = buildAppointmentReminderScheduleRevision(base)
    expect(buildAppointmentReminderScheduleRevision(base)).toBe(revision)
    expect(
      buildAppointmentReminderScheduleRevision({
        ...base,
        eventStartsAtUtc: new Date('2026-10-02T14:00:00.000Z'),
      }),
    ).not.toBe(revision)
    expect(
      buildAppointmentReminderScheduleRevision({
        ...base,
        eventId: 'occurrence-2',
      }),
    ).not.toBe(revision)
  })

  it('validates persisted schedule metadata and uses the schedule row as event identity', () => {
    expect(
      appointmentReminderMetadataSchema.safeParse({
        installationId: 'installation-1',
        automationId: 'automation-1',
        definitionVersion: 2,
        offsetMinutes: 60,
        eventStartsAtUtc: '2026-10-01T14:00:00.000Z',
        occurrenceOriginalAt: null,
        scheduleRevision: 'revision-1',
      }).success,
    ).toBe(true)
    expect(appointmentReminderEventKey('reminder-1')).toBe(
      'native:scheduling-reminder:reminder-1',
    )
  })
})

import { createHash } from 'crypto'

import { z } from 'zod'

export const APPOINTMENT_REMINDER_DEFINITION_VERSION = 2
export const SIMPLE_APPOINTMENT_REMINDER_SOURCE =
  'simple-automation:appointment-reminder:v2'

export const APPOINTMENT_REMINDER_LIFECYCLE_ERRORS = new Set([
  'Appointment Reminder is missing its occurrence identity.',
  'Appointment Reminder workspace does not match.',
  'Managed Appointment Reminder is no longer current.',
])

const appointmentEventTypes = new Set([
  'serviceAppointment',
  'estimate',
  'siteVisit',
  'discoveryCall',
  'consultation',
  'installationAppointment',
  'productDemonstration',
])

const offsetMinutesByValue = {
  '15-minutes': 15,
  '30-minutes': 30,
  '1-hour': 60,
  '1-day': 24 * 60,
} as const

export const appointmentReminderMetadataSchema = z
  .object({
    installationId: z.string().min(1),
    automationId: z.string().min(1),
    definitionVersion: z.literal(APPOINTMENT_REMINDER_DEFINITION_VERSION),
    offsetMinutes: z.union([
      z.literal(15),
      z.literal(30),
      z.literal(60),
      z.literal(24 * 60),
    ]),
    eventStartsAtUtc: z.string().datetime(),
    occurrenceOriginalAt: z.string().datetime().nullable(),
    scheduleRevision: z.string().min(1),
  })
  .strict()

export function isAppointmentReminderEventType(eventTypeKey: string) {
  return appointmentEventTypes.has(eventTypeKey)
}

export function isAppointmentReminderOccurrenceStateEligible(
  occurrenceState: string | null | undefined,
) {
  return ![
    'MASTER',
    'CANCELED',
    'COMPLETED',
    'SUPERSEDED',
    'DELETED',
  ].includes(occurrenceState ?? '')
}

export function getAppointmentReminderOffsetMinutes(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return null
  }
  const value = (config as Record<string, unknown>)['reminder-offset']
  return typeof value === 'string' && value in offsetMinutesByValue
    ? offsetMinutesByValue[value as keyof typeof offsetMinutesByValue]
    : null
}

export function buildAppointmentReminderScheduleRevision(input: {
  installationId: string
  eventId: string
  eventStartsAtUtc: Date
  occurrenceOriginalAt: Date | null
  offsetMinutes: number
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        installationId: input.installationId,
        eventId: input.eventId,
        eventStartsAtUtc: input.eventStartsAtUtc.toISOString(),
        occurrenceOriginalAt: input.occurrenceOriginalAt?.toISOString() ?? null,
        offsetMinutes: input.offsetMinutes,
        definitionVersion: APPOINTMENT_REMINDER_DEFINITION_VERSION,
      }),
    )
    .digest('hex')
}

export function appointmentReminderEventKey(reminderScheduleId: string) {
  return `native:scheduling-reminder:${reminderScheduleId}`
}

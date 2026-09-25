import { createHash } from 'crypto'

import { z } from 'zod'

import { isAppointmentReminderEventType } from '@/lib/automations/simpleAppointmentReminder'

export const SCHEDULE_CHANGE_DEFINITION_VERSION = 2
export const SIMPLE_SCHEDULE_CHANGE_SOURCE =
  'simple-automation:schedule-change-notification:v2'

export const SCHEDULE_CHANGE_LIFECYCLE_ERRORS = new Set([
  'Schedule Change Notification is missing its change identity.',
  'Schedule Change Notification workspace does not match.',
  'Managed Schedule Change Notification is no longer current.',
])

const changeTypeSchema = z.enum(['time', 'assignment', 'canceled'])

const scheduleStateSchema = z
  .object({
    startsAtUtc: z.string().datetime(),
    status: z.string().min(1),
    assignmentKeys: z.array(z.string().min(1)),
  })
  .strict()

export const scheduleChangeSnapshotSchema = z
  .object({
    definitionVersion: z.literal(SCHEDULE_CHANGE_DEFINITION_VERSION),
    eventId: z.string().min(1),
    eventTypeKey: z.string().min(1),
    title: z.string().min(1),
    timezone: z.string().min(1),
    recurrenceSeriesId: z.string().nullable(),
    occurrenceOriginalAt: z.string().datetime().nullable(),
    scope: z.enum(['single', 'thisOccurrence', 'thisAndFollowing', 'entireSeries']),
    changeTypes: z.array(changeTypeSchema).min(1),
    before: scheduleStateSchema,
    after: scheduleStateSchema,
    revision: z.string().min(1),
  })
  .strict()

export const scheduleChangeWorkMetadataSchema = z
  .object({
    installationId: z.string().min(1),
    automationId: z.string().min(1),
    outboxEventId: z.string().min(1),
    change: scheduleChangeSnapshotSchema,
  })
  .strict()

export type ScheduleChangeSnapshot = z.infer<typeof scheduleChangeSnapshotSchema>
export type ScheduleChangeType = z.infer<typeof changeTypeSchema>

type ScheduleChangeStateInput = {
  startsAtUtc: Date
  status: string
  assignments: Array<{
    workspaceMemberId?: string | null
    teamId?: string | null
  }>
}

export function normalizedScheduleAssignmentKeys(
  assignments: ScheduleChangeStateInput['assignments'],
) {
  return Array.from(
    new Set(
      assignments.flatMap((assignment) => [
        ...(assignment.workspaceMemberId
          ? [`member:${assignment.workspaceMemberId}`]
          : []),
        ...(assignment.teamId ? [`team:${assignment.teamId}`] : []),
      ]),
    ),
  ).sort()
}

function normalizedState(input: ScheduleChangeStateInput) {
  return {
    startsAtUtc: input.startsAtUtc.toISOString(),
    status: input.status,
    assignmentKeys: normalizedScheduleAssignmentKeys(input.assignments),
  }
}

export function buildScheduleChangeSnapshot(input: {
  eventId: string
  eventTypeKey: string
  title: string
  timezone: string
  recurrenceSeriesId?: string | null
  occurrenceOriginalAt?: Date | null
  occurrenceState?: string | null
  scope: ScheduleChangeSnapshot['scope']
  before: ScheduleChangeStateInput
  after: ScheduleChangeStateInput
}) {
  if (
    !isAppointmentReminderEventType(input.eventTypeKey) ||
    ['MASTER', 'SUPERSEDED', 'DELETED'].includes(input.occurrenceState ?? '')
  ) {
    return null
  }
  const before = normalizedState(input.before)
  const after = normalizedState(input.after)
  const changeTypes: ScheduleChangeType[] = []
  if (before.startsAtUtc !== after.startsAtUtc) changeTypes.push('time')
  if (
    before.assignmentKeys.length !== after.assignmentKeys.length ||
    before.assignmentKeys.some((key, index) => key !== after.assignmentKeys[index])
  ) {
    changeTypes.push('assignment')
  }
  if (before.status !== 'canceled' && after.status === 'canceled') {
    changeTypes.push('canceled')
  }
  if (!changeTypes.length) return null

  const identity = {
    definitionVersion: SCHEDULE_CHANGE_DEFINITION_VERSION,
    eventId: input.eventId,
    occurrenceOriginalAt: input.occurrenceOriginalAt?.toISOString() ?? null,
    scope: input.scope,
    changeTypes,
    before,
    after,
  }
  return {
    definitionVersion: SCHEDULE_CHANGE_DEFINITION_VERSION,
    eventId: input.eventId,
    eventTypeKey: input.eventTypeKey,
    title: input.title,
    timezone: input.timezone,
    recurrenceSeriesId: input.recurrenceSeriesId ?? null,
    occurrenceOriginalAt: input.occurrenceOriginalAt?.toISOString() ?? null,
    scope: input.scope,
    changeTypes,
    before,
    after,
    revision: createHash('sha256')
      .update(JSON.stringify(identity))
      .digest('hex'),
  } satisfies ScheduleChangeSnapshot
}

export function scheduleChangeEventKey(reminderScheduleId: string) {
  return `native:schedule-change:${reminderScheduleId}`
}

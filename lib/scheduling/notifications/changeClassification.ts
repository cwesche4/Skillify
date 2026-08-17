import type {
  SchedulingEvent,
  SchedulingNotificationCategory,
} from '@/lib/scheduling/types'

export type SchedulingNotificationChangeClassification = {
  categories: SchedulingNotificationCategory[]
  changedFields: string[]
  assignmentChanged: boolean
  removedAssigneeIds: string[]
  addedAssigneeIds: string[]
  timeChanged: boolean
  dateChanged: boolean
  locationChanged: boolean
  linkedRecordChanged: boolean
  statusChanged: boolean
  recurrenceChanged: boolean
  suppressUserNotification: boolean
}

const ignoredFields = new Set([
  'updatedAt',
  'generatedThroughUtc',
  'version',
  'recurrenceLineage',
  'overrideFields',
  'metadata',
])

function sorted(values: string[] | undefined) {
  return [...new Set(values ?? [])].sort()
}

function difference(after: string[], before: string[]) {
  const beforeSet = new Set(before)
  return after.filter((value) => !beforeSet.has(value))
}

export function classifySchedulingNotificationChanges({
  before,
  after,
  changedFields,
  topic,
}: {
  before?: Partial<SchedulingEvent> | null
  after?: Partial<SchedulingEvent> | null
  changedFields?: string[]
  topic?: string
}): SchedulingNotificationChangeClassification {
  const beforeAssignees = sorted(before?.assignedMemberIds)
  const afterAssignees = sorted(after?.assignedMemberIds)
  const addedAssigneeIds = difference(afterAssignees, beforeAssignees)
  const removedAssigneeIds = difference(beforeAssignees, afterAssignees)
  const assignmentChanged =
    addedAssigneeIds.length > 0 || removedAssigneeIds.length > 0
  const beforeStartsAt = before?.startsAt
  const afterStartsAt = after?.startsAt
  const beforeEndsAt = before?.endsAt
  const afterEndsAt = after?.endsAt
  const beforeTimezone = before?.timezone
  const afterTimezone = after?.timezone
  const beforeStatus = before?.status
  const afterStatus = after?.status
  const timeChanged =
    Boolean(
      beforeStartsAt && afterStartsAt && beforeStartsAt !== afterStartsAt,
    ) ||
    Boolean(beforeEndsAt && afterEndsAt && beforeEndsAt !== afterEndsAt) ||
    Boolean(beforeTimezone && afterTimezone && beforeTimezone !== afterTimezone)
  const dateChanged =
    Boolean(beforeStartsAt && afterStartsAt) &&
    beforeStartsAt?.slice(0, 10) !== afterStartsAt?.slice(0, 10)
  const locationChanged =
    before?.location !== after?.location ||
    before?.locationLabel !== after?.locationLabel ||
    before?.locationAddress !== after?.locationAddress ||
    before?.meetingUrl !== after?.meetingUrl
  const linkedRecordChanged =
    before?.linkedRecord?.recordType !== after?.linkedRecord?.recordType ||
    before?.linkedRecord?.recordId !== after?.linkedRecord?.recordId
  const statusChanged =
    Boolean(beforeStatus && afterStatus) && beforeStatus !== afterStatus
  const recurrenceChanged =
    JSON.stringify(before?.recurrenceRule ?? null) !==
    JSON.stringify(after?.recurrenceRule ?? null)
  const fields = [
    ...(changedFields ?? []),
    ...(assignmentChanged ? ['assignedMemberIds'] : []),
    ...(timeChanged ? ['startsAt', 'endsAt', 'timezone'] : []),
    ...(locationChanged ? ['location'] : []),
    ...(linkedRecordChanged ? ['linkedRecord'] : []),
    ...(statusChanged ? ['status'] : []),
    ...(recurrenceChanged ? ['recurrenceRule'] : []),
  ].filter((field) => !ignoredFields.has(field))

  const categories = new Set<SchedulingNotificationCategory>()
  if (topic === 'scheduling.event.created') categories.add('assignment')
  if (topic?.includes('canceled')) categories.add('canceled')
  if (topic?.includes('completed')) categories.add('completed')
  if (topic?.includes('series_updated') || topic?.includes('series.updated')) {
    categories.add('recurringSeriesChanged')
  }
  if (assignmentChanged) {
    categories.add(removedAssigneeIds.length ? 'reassignment' : 'assignment')
  }
  if (timeChanged) categories.add('rescheduled')
  if (statusChanged && after?.status === 'canceled') categories.add('canceled')
  if (statusChanged && after?.status === 'completed')
    categories.add('completed')
  if (statusChanged && after?.status === 'missed') categories.add('missed')
  if (
    fields.length &&
    !categories.size &&
    (locationChanged || linkedRecordChanged)
  ) {
    categories.add('eventUpdated')
  }

  return {
    categories: [...categories],
    changedFields: [...new Set(fields)],
    assignmentChanged,
    removedAssigneeIds,
    addedAssigneeIds,
    timeChanged,
    dateChanged,
    locationChanged,
    linkedRecordChanged,
    statusChanged,
    recurrenceChanged,
    suppressUserNotification:
      categories.size === 0 ||
      (fields.length > 0 && fields.every((field) => ignoredFields.has(field))),
  }
}

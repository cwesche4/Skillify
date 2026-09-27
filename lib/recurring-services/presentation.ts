import type {
  RecurringServiceClientJob,
  RecurringServiceClientRecord,
} from '@/lib/recurring-services/clientTypes'
import type { SchedulingRecurrenceRule } from '@/lib/scheduling/types'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const recurringServiceStatusLabels = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ENDED: 'Ended',
} as const

export function formatRecurringServiceCadence(
  rule: SchedulingRecurrenceRule | null | undefined,
) {
  if (!rule) return 'Schedule unavailable'
  const interval = Math.max(1, rule.interval)
  const unit =
    rule.frequency === 'daily'
      ? 'day'
      : rule.frequency === 'weekly'
        ? 'week'
        : rule.frequency === 'monthly'
          ? 'month'
          : 'year'
  const cadence =
    interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`
  const days =
    rule.frequency === 'weekly' && rule.daysOfWeek?.length
      ? rule.daysOfWeek
          .map((day) => weekdays[day])
          .filter(Boolean)
          .join(', ')
      : ''
  return days ? `${cadence} · ${days}` : cadence
}

export function recurringServiceAssignmentLabel(
  service: RecurringServiceClientRecord,
  memberNames: Map<string, string>,
  teamNames: Map<string, string>,
) {
  const assignments = service.recurrenceSeries?.masterEvent.assignments ?? []
  if (!assignments.length) return 'Unassigned'
  return assignments
    .map((assignment) =>
      assignment.assignmentType === 'TEAM'
        ? assignment.displaySnapshot ||
          (assignment.teamId ? teamNames.get(assignment.teamId) : undefined) ||
          'Team'
        : (assignment.workspaceMemberId
            ? memberNames.get(assignment.workspaceMemberId)
            : undefined) ||
          assignment.displaySnapshot ||
          'Team member',
    )
    .join(', ')
}

function endOfWeek(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  result.setDate(result.getDate() + ((7 - result.getDay()) % 7))
  return result
}

export function boundedUpcomingJobs(
  jobs: RecurringServiceClientJob[],
  requestedCount = 12,
  now = new Date(),
) {
  const upcoming = jobs
    .filter(
      (job) =>
        job.scheduledStartAt &&
        new Date(job.scheduledStartAt).getTime() >= now.getTime() &&
        job.status !== 'CANCELED' &&
        job.status !== 'COMPLETED',
    )
    .sort(
      (left, right) =>
        new Date(left.scheduledStartAt as string).getTime() -
        new Date(right.scheduledStartAt as string).getTime(),
    )
  if (upcoming.length <= requestedCount) return upcoming
  const boundary = endOfWeek(
    new Date(
      upcoming[Math.max(0, requestedCount - 1)].scheduledStartAt as string,
    ),
  ).getTime()
  return upcoming.filter(
    (job) => new Date(job.scheduledStartAt as string).getTime() <= boundary,
  )
}

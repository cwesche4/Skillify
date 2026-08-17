import { doesSchedulingStatusConsumeAvailability } from '@/lib/scheduling/events/statusTransitions'
import type {
  SchedulingEvent,
  SchedulingOccurrence,
} from '@/lib/scheduling/types'

export type SchedulingAvailabilityConflict = {
  eventId: string
  occurrenceId?: string
  title: string
  assignedMemberIds: string[]
  startsAt: string
  endsAt: string
}

export function intervalsOverlap(
  first: { startsAt: string | Date; endsAt: string | Date },
  second: { startsAt: string | Date; endsAt: string | Date },
): boolean {
  const firstStart = new Date(first.startsAt).getTime()
  const firstEnd = new Date(first.endsAt).getTime()
  const secondStart = new Date(second.startsAt).getTime()
  const secondEnd = new Date(second.endsAt).getTime()
  return firstStart < secondEnd && secondStart < firstEnd
}

export function doesSchedulingEventConsumeAvailability({
  event,
  workspaceNow = new Date(),
}: {
  event: Pick<SchedulingEvent, 'status' | 'assignedMemberIds' | 'endsAt'> &
    Partial<Pick<SchedulingOccurrence, 'occurrenceEndsAt'>>
  workspaceNow?: Date
}): boolean {
  if (event.assignedMemberIds.length === 0) return false
  if (!doesSchedulingStatusConsumeAvailability(event.status)) return false
  if (event.status === 'inProgress') return true
  return (
    new Date(event.occurrenceEndsAt ?? event.endsAt).getTime() >
    workspaceNow.getTime()
  )
}

export function findSchedulingAvailabilityConflicts({
  candidate,
  existing,
  workspaceNow = new Date(),
}: {
  candidate: Pick<
    SchedulingEvent,
    'id' | 'startsAt' | 'endsAt' | 'assignedMemberIds'
  >
  existing: Array<SchedulingEvent | SchedulingOccurrence>
  workspaceNow?: Date
}): SchedulingAvailabilityConflict[] {
  const assignedIds = new Set(candidate.assignedMemberIds)
  if (assignedIds.size === 0) return []

  return existing
    .filter((event) => event.id !== candidate.id)
    .filter((event) =>
      event.assignedMemberIds.some((memberId) => assignedIds.has(memberId)),
    )
    .filter((event) =>
      doesSchedulingEventConsumeAvailability({ event, workspaceNow }),
    )
    .filter((event) =>
      intervalsOverlap(candidate, {
        startsAt:
          'occurrenceStartsAt' in event
            ? event.occurrenceStartsAt
            : event.startsAt,
        endsAt:
          'occurrenceEndsAt' in event ? event.occurrenceEndsAt : event.endsAt,
      }),
    )
    .map((event) => ({
      eventId: event.id,
      occurrenceId: 'occurrenceId' in event ? event.occurrenceId : undefined,
      title: event.title,
      assignedMemberIds: event.assignedMemberIds,
      startsAt:
        'occurrenceStartsAt' in event
          ? event.occurrenceStartsAt
          : event.startsAt,
      endsAt:
        'occurrenceEndsAt' in event ? event.occurrenceEndsAt : event.endsAt,
    }))
}

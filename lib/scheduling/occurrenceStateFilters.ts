import { SchedulingOccurrenceState as PrismaSchedulingOccurrenceState } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export function isListEventsByRangeVisibleOccurrenceState(
  occurrenceState:
    | PrismaSchedulingOccurrenceState
    | `${PrismaSchedulingOccurrenceState}`
    | null
    | undefined,
) {
  return (
    occurrenceState == null ||
    occurrenceState === PrismaSchedulingOccurrenceState.GENERATED
  )
}

export function getListEventsByRangeOccurrenceStateWhere(): Prisma.SchedulingEventWhereInput {
  // TODO: NULL currently represents a standalone one-time event. A future data
  // migration should make this explicit with an occurrence state such as
  // STANDALONE alongside MASTER, GENERATED, SUPERSEDED, CANCELED, and DELETED.
  return {
    OR: [
      { occurrenceState: null },
      { occurrenceState: PrismaSchedulingOccurrenceState.GENERATED },
    ],
  }
}

export function getListEventsByRangeWhere({
  workspaceId,
  includeDeleted,
  startsBefore,
  endsAfter,
}: {
  workspaceId: string
  includeDeleted?: boolean
  startsBefore?: Date
  endsAfter?: Date
}): Prisma.SchedulingEventWhereInput {
  return {
    workspaceId,
    deletedAt: includeDeleted ? undefined : null,
    startsAtUtc: startsBefore ? { lt: startsBefore } : undefined,
    endsAtUtc: endsAfter ? { gt: endsAfter } : undefined,
    ...getListEventsByRangeOccurrenceStateWhere(),
  }
}

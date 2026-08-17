import { CalendarEventSyncState } from '@prisma/client'

import { prisma } from '@/lib/db'

export async function markSchedulingEventForExternalSync({
  workspaceId,
  eventId,
  recurrenceSeriesId,
  originOperation,
}: {
  workspaceId: string
  eventId: string
  recurrenceSeriesId?: string | null
  originOperation: string
}) {
  const where =
    recurrenceSeriesId && originOperation.includes('series')
      ? { workspaceId, recurrenceSeriesId }
      : { workspaceId, schedulingEventId: eventId }
  await prisma.calendarEventMapping.updateMany({
    where,
    data: {
      syncState: CalendarEventSyncState.PENDING_PUSH,
      lastSyncOrigin: 'skillify',
      originOperation,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
}

export async function markSchedulingEventDeletedForExternalSync({
  workspaceId,
  eventId,
  recurrenceSeriesId,
  originOperation,
}: {
  workspaceId: string
  eventId: string
  recurrenceSeriesId?: string | null
  originOperation: string
}) {
  const where =
    recurrenceSeriesId && originOperation.includes('series')
      ? { workspaceId, recurrenceSeriesId }
      : { workspaceId, schedulingEventId: eventId }
  await prisma.calendarEventMapping.updateMany({
    where,
    data: {
      syncState: CalendarEventSyncState.SKILLIFY_DELETED,
      deletedAtSkillify: true,
      lastSyncOrigin: 'skillify',
      originOperation,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
}

import { CalendarEventSyncState, CalendarProvider } from '@prisma/client'
import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export async function GET(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    const [
      connectedAccounts,
      selectedCalendars,
      pendingPull,
      pendingPush,
      failedMappings,
      openConflicts,
    ] = await Promise.all([
      prisma.calendarConnection.count({
        where: { provider: CalendarProvider.CALDAV, disconnectedAt: null },
      }),
      prisma.connectedCalendar.count({
        where: {
          selectedForSync: true,
          connection: { provider: CalendarProvider.CALDAV },
        },
      }),
      prisma.calendarEventMapping.count({
        where: {
          syncState: CalendarEventSyncState.PENDING_PULL,
          connectedCalendar: {
            connection: { provider: CalendarProvider.CALDAV },
          },
        },
      }),
      prisma.calendarEventMapping.count({
        where: {
          syncState: CalendarEventSyncState.PENDING_PUSH,
          connectedCalendar: {
            connection: { provider: CalendarProvider.CALDAV },
          },
        },
      }),
      prisma.calendarEventMapping.count({
        where: {
          syncState: CalendarEventSyncState.FAILED,
          connectedCalendar: {
            connection: { provider: CalendarProvider.CALDAV },
          },
        },
      }),
      prisma.calendarSyncConflict.count({
        where: { provider: CalendarProvider.CALDAV, status: 'OPEN' },
      }),
    ])
    return Response.json({
      ok: true,
      provider: 'caldav',
      workerId: runtime.workerId,
      diagnostics: {
        connectedAccounts,
        selectedCalendars,
        pendingPull,
        pendingPush,
        failedMappings,
        openConflicts,
        activeWatchChannels: 0,
        expiredWatchChannels: 0,
      },
    })
  })
}

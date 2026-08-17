import {
  CalendarEventSyncState,
  CalendarProvider,
  CalendarWatchChannelStatus,
} from '@prisma/client'
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
      activeWatchChannels,
      expiredWatchChannels,
    ] = await Promise.all([
      prisma.calendarConnection.count({
        where: { provider: CalendarProvider.GOOGLE, disconnectedAt: null },
      }),
      prisma.connectedCalendar.count({
        where: {
          selectedForSync: true,
          connection: { provider: CalendarProvider.GOOGLE },
        },
      }),
      prisma.calendarEventMapping.count({
        where: { syncState: CalendarEventSyncState.PENDING_PULL },
      }),
      prisma.calendarEventMapping.count({
        where: { syncState: CalendarEventSyncState.PENDING_PUSH },
      }),
      prisma.calendarEventMapping.count({
        where: { syncState: CalendarEventSyncState.FAILED },
      }),
      prisma.calendarSyncConflict.count({ where: { status: 'OPEN' } }),
      prisma.calendarWatchChannel.count({
        where: {
          provider: CalendarProvider.GOOGLE,
          status: CalendarWatchChannelStatus.ACTIVE,
        },
      }),
      prisma.calendarWatchChannel.count({
        where: {
          provider: CalendarProvider.GOOGLE,
          status: CalendarWatchChannelStatus.ACTIVE,
          expiresAt: { lte: runtime.nowUtc },
        },
      }),
    ])
    return Response.json({
      ok: true,
      provider: 'google',
      workerId: runtime.workerId,
      diagnostics: {
        connectedAccounts,
        selectedCalendars,
        pendingPull,
        pendingPush,
        failedMappings,
        openConflicts,
        activeWatchChannels,
        expiredWatchChannels,
      },
    })
  })
}

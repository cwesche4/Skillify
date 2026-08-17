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

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    if (runtime.dryRun) {
      const [expiredChannels, failedMappings] = await Promise.all([
        prisma.calendarWatchChannel.count({
          where: {
            provider: CalendarProvider.OUTLOOK,
            status: CalendarWatchChannelStatus.ACTIVE,
            expiresAt: { lte: runtime.nowUtc },
          },
        }),
        prisma.calendarEventMapping.count({
          where: { syncState: CalendarEventSyncState.FAILED },
        }),
      ])
      return Response.json({
        ok: true,
        dryRun: true,
        expiredChannels,
        failedMappings,
      })
    }
    const [expiredChannels, failedMappings] = await Promise.all([
      prisma.calendarWatchChannel.updateMany({
        where: {
          provider: CalendarProvider.OUTLOOK,
          status: CalendarWatchChannelStatus.ACTIVE,
          expiresAt: { lte: runtime.nowUtc },
        },
        data: { status: CalendarWatchChannelStatus.EXPIRED },
      }),
      prisma.calendarEventMapping.updateMany({
        where: { syncState: CalendarEventSyncState.FAILED },
        data: {
          syncState: CalendarEventSyncState.PENDING_PUSH,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      }),
    ])
    return Response.json({
      ok: true,
      recovered: {
        expiredChannels: expiredChannels.count,
        failedMappings: failedMappings.count,
      },
      workerId: runtime.workerId,
    })
  })
}

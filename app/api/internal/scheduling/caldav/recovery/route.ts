import { CalendarEventSyncState, CalendarProvider } from '@prisma/client'
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
      const failedMappings = await prisma.calendarEventMapping.count({
        where: {
          syncState: CalendarEventSyncState.FAILED,
          connectedCalendar: {
            connection: { provider: CalendarProvider.CALDAV },
          },
        },
      })
      return Response.json({
        ok: true,
        provider: 'caldav',
        dryRun: true,
        failedMappings,
      })
    }
    const failedMappings = await prisma.calendarEventMapping.updateMany({
      where: {
        syncState: CalendarEventSyncState.FAILED,
        connectedCalendar: {
          connection: { provider: CalendarProvider.CALDAV },
        },
      },
      data: {
        syncState: CalendarEventSyncState.PENDING_PULL,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
    return Response.json({
      ok: true,
      provider: 'caldav',
      recovered: {
        failedMappings: failedMappings.count,
      },
      workerId: runtime.workerId,
    })
  })
}

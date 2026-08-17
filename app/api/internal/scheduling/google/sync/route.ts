import { CalendarConnectionStatus, CalendarProvider } from '@prisma/client'
import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { syncGoogleCalendarConnection } from '@/lib/scheduling/providers/googleService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    const connections = await prisma.calendarConnection.findMany({
      where: {
        provider: CalendarProvider.GOOGLE,
        syncStatus: {
          in: [
            CalendarConnectionStatus.CONNECTED,
            CalendarConnectionStatus.INITIAL_SYNC,
            CalendarConnectionStatus.NEEDS_ATTENTION,
          ],
        },
        disconnectedAt: null,
        OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: runtime.nowUtc } }],
      },
      select: { id: true, workspaceId: true },
      take: runtime.batchSize,
      orderBy: [{ nextSyncAt: 'asc' }, { updatedAt: 'asc' }],
    })
    const results = []
    for (const connection of connections) {
      results.push(
        await syncGoogleCalendarConnection({
          workspaceId: connection.workspaceId,
          connectionId: connection.id,
          workerId: runtime.workerId,
          dryRun: runtime.dryRun,
        }),
      )
    }
    return Response.json({
      ok: true,
      dryRun: runtime.dryRun,
      processed: results.length,
      failed: results.filter((result) => !result.ok).length,
      workerId: runtime.workerId,
    })
  })
}

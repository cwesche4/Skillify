import { CalendarConnectionStatus, CalendarProvider } from '@prisma/client'
import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { refreshMicrosoftCalendarConnection } from '@/lib/scheduling/providers/microsoftService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    const dueBefore = new Date(runtime.nowUtc.getTime() + 5 * 60_000)
    const connections = await prisma.calendarConnection.findMany({
      where: {
        provider: CalendarProvider.OUTLOOK,
        syncStatus: {
          in: [
            CalendarConnectionStatus.CONNECTED,
            CalendarConnectionStatus.NEEDS_ATTENTION,
          ],
        },
        refreshTokenEncrypted: { not: null },
        OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { lte: dueBefore } }],
      },
      select: { id: true, workspaceId: true },
      take: runtime.batchSize,
      orderBy: { updatedAt: 'asc' },
    })
    if (runtime.dryRun) {
      return Response.json({ ok: true, dryRun: true, due: connections.length })
    }
    const results = []
    for (const connection of connections) {
      results.push(
        await refreshMicrosoftCalendarConnection({
          workspaceId: connection.workspaceId,
          connectionId: connection.id,
        }),
      )
    }
    return Response.json({
      ok: true,
      processed: results.length,
      failed: results.filter((result) => !result.ok).length,
      workerId: runtime.workerId,
    })
  })
}

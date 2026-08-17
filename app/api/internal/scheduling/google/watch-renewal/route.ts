import {
  CalendarConnectionStatus,
  CalendarProvider,
  CalendarWatchChannelStatus,
} from '@prisma/client'
import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { renewGoogleCalendarWatchChannels } from '@/lib/scheduling/providers/googleService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    const webhookUrl =
      process.env.GOOGLE_CALENDAR_WEBHOOK_URL ??
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/scheduling/google/webhook`
        : null)
    if (!webhookUrl) {
      return Response.json(
        {
          ok: false,
          code: 'WEBHOOK_URL_NOT_CONFIGURED',
          message: 'Google Calendar webhook URL is not configured.',
        },
        { status: 503 },
      )
    }
    const renewBefore = new Date(runtime.nowUtc.getTime() + 24 * 60 * 60_000)
    const connections = await prisma.calendarConnection.findMany({
      where: {
        provider: CalendarProvider.GOOGLE,
        syncStatus: CalendarConnectionStatus.CONNECTED,
        disconnectedAt: null,
        calendars: { some: { selectedForSync: true } },
        OR: [
          {
            watchChannels: {
              none: { status: CalendarWatchChannelStatus.ACTIVE },
            },
          },
          {
            watchChannels: {
              some: {
                status: CalendarWatchChannelStatus.ACTIVE,
                expiresAt: { lte: renewBefore },
              },
            },
          },
        ],
      },
      select: { id: true, workspaceId: true },
      take: runtime.batchSize,
    })
    if (runtime.dryRun) {
      return Response.json({ ok: true, dryRun: true, due: connections.length })
    }
    const results = []
    for (const connection of connections) {
      results.push(
        await renewGoogleCalendarWatchChannels({
          workspaceId: connection.workspaceId,
          connectionId: connection.id,
          webhookUrl,
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

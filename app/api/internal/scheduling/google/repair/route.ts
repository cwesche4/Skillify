import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { inspectGoogleCalendarMappingIntegrity } from '@/lib/scheduling/providers/googleService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    const workspaces = await prisma.workspace.findMany({
      where: { calendarConnections: { some: { provider: 'GOOGLE' } } },
      select: { id: true },
      take: runtime.batchSize,
    })
    const results = []
    for (const workspace of workspaces) {
      results.push(
        await inspectGoogleCalendarMappingIntegrity({
          workspaceId: workspace.id,
          repair: !runtime.dryRun,
        }),
      )
    }
    return NextResponse.json({
      ok: true,
      dryRun: runtime.dryRun,
      processed: results.length,
      workerId: runtime.workerId,
      results,
    })
  })
}

import { type NextRequest } from 'next/server'

import {
  getSchedulingNotificationWorkerDiagnostics,
  processPendingNotificationDeliveries,
} from '@/lib/scheduling/notifications/notificationService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    if (runtime.dryRun) {
      return Response.json({
        ok: true,
        worker: 'deliveries',
        dryRun: true,
        cursor: runtime.cursor,
        diagnostics: await getSchedulingNotificationWorkerDiagnostics({
          nowUtc: runtime.nowUtc,
        }),
      })
    }
    return Response.json({
      ok: true,
      worker: 'deliveries',
      cursor: runtime.cursor,
      deliveries: await processPendingNotificationDeliveries(runtime),
    })
  })
}

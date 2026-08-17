import { type NextRequest } from 'next/server'

import {
  getSchedulingNotificationWorkerDiagnostics,
  processSchedulingNotificationOutbox,
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
        worker: 'outbox',
        dryRun: true,
        cursor: runtime.cursor,
        diagnostics: await getSchedulingNotificationWorkerDiagnostics({
          nowUtc: runtime.nowUtc,
        }),
      })
    }
    return Response.json({
      ok: true,
      worker: 'outbox',
      cursor: runtime.cursor,
      outbox: await processSchedulingNotificationOutbox(runtime),
    })
  })
}

import { type NextRequest } from 'next/server'

import {
  getSchedulingNotificationWorkerDiagnostics,
  processDueSchedulingReminders,
  processPendingNotificationDeliveries,
  processSchedulingNotificationOutbox,
} from '@/lib/scheduling/notifications/notificationService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../_lib/workerRuntime'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    if (runtime.dryRun) {
      return Response.json({
        ok: true,
        dryRun: true,
        cursor: runtime.cursor,
        diagnostics: await getSchedulingNotificationWorkerDiagnostics({
          nowUtc: runtime.nowUtc,
        }),
      })
    }
    const outbox = await processSchedulingNotificationOutbox(runtime)
    const reminders = await processDueSchedulingReminders(runtime)
    const deliveries = await processPendingNotificationDeliveries(runtime)
    return Response.json({
      ok: true,
      cursor: runtime.cursor,
      outbox,
      reminders,
      deliveries,
    })
  })
}

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
import { withInternalCronAuth } from '@/lib/auth/cron'

export const dynamic = 'force-dynamic'

async function runSchedulingWorker(request: NextRequest) {
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
}

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, () => runSchedulingWorker(request))
}

export async function GET(request: NextRequest) {
  return withInternalCronAuth(request, () => runSchedulingWorker(request))
}

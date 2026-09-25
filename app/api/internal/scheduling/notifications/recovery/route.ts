import { type NextRequest } from 'next/server'

import {
  getSchedulingNotificationWorkerDiagnostics,
  recoverSchedulingNotificationWorkerLeases,
} from '@/lib/scheduling/notifications/notificationService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'
import { withInternalCronAuth } from '@/lib/auth/cron'

export const dynamic = 'force-dynamic'

async function runRecovery(request: NextRequest) {
    const runtime = await parseSchedulingWorkerRequest(request)
    const before = await getSchedulingNotificationWorkerDiagnostics({
      nowUtc: runtime.nowUtc,
    })
    if (runtime.dryRun) {
      return Response.json({
        ok: true,
        worker: 'recovery',
        dryRun: true,
        cursor: runtime.cursor,
        diagnostics: before,
      })
    }
    const recovered = await recoverSchedulingNotificationWorkerLeases({
      nowUtc: runtime.nowUtc,
    })
    return Response.json({
      ok: true,
      worker: 'recovery',
      cursor: runtime.cursor,
      before,
      recovered,
      after: await getSchedulingNotificationWorkerDiagnostics({
        nowUtc: runtime.nowUtc,
      }),
    })
}

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, () => runRecovery(request))
}

export async function GET(request: NextRequest) {
  return withInternalCronAuth(request, () => runRecovery(request))
}

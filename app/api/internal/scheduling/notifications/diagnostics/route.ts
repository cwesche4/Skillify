import { type NextRequest } from 'next/server'

import { getSchedulingNotificationWorkerDiagnostics } from '@/lib/scheduling/notifications/notificationService'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../../_lib/workerRuntime'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withSchedulingWorkerAuth(request, async () => {
    const runtime = await parseSchedulingWorkerRequest(request)
    return Response.json({
      ok: true,
      worker: 'diagnostics',
      cursor: runtime.cursor,
      diagnostics: await getSchedulingNotificationWorkerDiagnostics({
        nowUtc: runtime.nowUtc,
      }),
    })
  })
}

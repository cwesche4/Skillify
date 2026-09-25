import { type NextRequest } from 'next/server'

import { withInternalCronAuth } from '@/lib/auth/cron'
import { extendSchedulingRecurrenceHorizon } from '@/lib/scheduling/repository'
import {
  parseSchedulingWorkerRequest,
  withSchedulingWorkerAuth,
} from '../_lib/workerRuntime'

export const dynamic = 'force-dynamic'

async function runRecurrenceHorizonWorker(request: NextRequest) {
  const runtime = await parseSchedulingWorkerRequest(request)
  if (runtime.dryRun) {
    return Response.json({
      ok: true,
      worker: 'recurrence-horizon',
      dryRun: true,
    })
  }
  const result = await extendSchedulingRecurrenceHorizon({
    nowUtc: runtime.nowUtc,
    batchSize: Math.min(runtime.batchSize, 25),
  })
  return Response.json({ ok: true, worker: 'recurrence-horizon', ...result })
}

export async function POST(request: NextRequest) {
  return withSchedulingWorkerAuth(request, () =>
    runRecurrenceHorizonWorker(request),
  )
}

export async function GET(request: NextRequest) {
  return withInternalCronAuth(request, () =>
    runRecurrenceHorizonWorker(request),
  )
}

import { withInternalCronAuth } from '@/lib/auth/cron'
import { processEstimateDeliveryQueue } from '@/lib/estimates/deliveryWorker'

export const dynamic = 'force-dynamic'

function boundedBatchSize(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 1), 50)
    : undefined
}

async function runProcessor(request: Request) {
  const body =
    request.method === 'GET'
      ? {}
      : ((await request.json().catch(() => ({}))) as { batchSize?: number })
  const queryBatchSize = new URL(request.url).searchParams.get('batchSize')
  const result = await processEstimateDeliveryQueue({
    batchSize: boundedBatchSize(queryBatchSize ?? body.batchSize),
  })
  return Response.json({ ok: true, ...result })
}

export async function POST(request: Request) {
  return withInternalCronAuth(request, () => runProcessor(request))
}

export async function GET(request: Request) {
  return withInternalCronAuth(request, () => runProcessor(request))
}

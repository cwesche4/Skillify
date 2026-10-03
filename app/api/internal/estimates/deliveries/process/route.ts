import { withInternalCronAuth } from '@/lib/auth/cron'
import { processEstimateDeliveryQueue } from '@/lib/estimates/deliveryWorker'

export async function POST(request: Request) {
  return withInternalCronAuth(request, async () => {
    const body = (await request.json().catch(() => ({}))) as {
      batchSize?: number
    }
    const result = await processEstimateDeliveryQueue({
      batchSize:
        typeof body.batchSize === 'number' ? body.batchSize : undefined,
    })
    return Response.json({ ok: true, ...result })
  })
}

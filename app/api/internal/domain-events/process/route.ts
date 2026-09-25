import { randomUUID } from 'crypto'
import { type NextRequest } from 'next/server'

import { authenticateServiceToken } from '@/lib/auth/serviceToken'
import { withInternalCronAuth } from '@/lib/auth/cron'
import { processPendingDomainEvents } from '@/lib/domain-events/processor'

export const dynamic = 'force-dynamic'

async function runProcessor(
  request: NextRequest,
  workerIdentity: string,
) {
  const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}))
  const requestedLimit = Number(
    request.nextUrl.searchParams.get('batchSize') ??
      (body && typeof body === 'object' ? body.batchSize : undefined),
  )
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
    : 25
  const result = await processPendingDomainEvents({
    limit,
    // Every invocation needs a distinct lease identity. Reusing only the
    // service name would let an older concurrent request pass another
    // invocation's claimedBy fencing after a stale-lease reclaim.
    workerId: `${workerIdentity}:${randomUUID()}`,
  })
  return Response.json({ ok: true, ...result })
}

export async function POST(request: NextRequest) {
  const authorization = await authenticateServiceToken(
    request,
    'DOMAIN_EVENT_PROCESSOR',
  )
  if (!authorization.ok) return authorization.response
  return runProcessor(request, `service:${authorization.system}`)
}

export async function GET(request: NextRequest) {
  return withInternalCronAuth(request, () =>
    runProcessor(request, 'cron:domain-events'),
  )
}

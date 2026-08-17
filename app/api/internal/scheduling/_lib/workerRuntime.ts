import { randomUUID } from 'crypto'
import { type NextRequest } from 'next/server'

export function isSchedulingWorkerAuthorized(request: NextRequest) {
  const secret = process.env.SCHEDULING_WORKER_SECRET ?? process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  return token === secret
}

export function schedulingWorkerUnauthorizedResponse() {
  return Response.json(
    {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Scheduling worker authorization failed.',
    },
    { status: 401 },
  )
}

export async function parseSchedulingWorkerRequest(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const searchParams = request.nextUrl.searchParams
  const batchSize = Math.min(
    Math.max(Number(body.batchSize ?? searchParams.get('batchSize') ?? 50), 1),
    100,
  )
  const nowUtc = new Date(
    String(
      body.nowUtc ?? searchParams.get('nowUtc') ?? new Date().toISOString(),
    ),
  )
  const dryRun = body.dryRun === true || searchParams.get('dryRun') === 'true'
  const cursor = String(body.cursor ?? searchParams.get('cursor') ?? '')
  return {
    batchSize,
    nowUtc: Number.isNaN(nowUtc.getTime()) ? new Date() : nowUtc,
    dryRun,
    cursor: cursor || null,
    workerId: `http-worker-${randomUUID()}`,
  }
}

export async function withSchedulingWorkerAuth(
  request: NextRequest,
  handler: () => Promise<Response>,
) {
  if (!isSchedulingWorkerAuthorized(request)) {
    return schedulingWorkerUnauthorizedResponse()
  }
  return handler()
}

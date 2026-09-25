import { timingSafeEqual } from 'crypto'

function tokensEqual(first: string, second: string) {
  const left = Buffer.from(first, 'utf8')
  const right = Buffer.from(second, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function isInternalCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : ''
  return Boolean(token) && tokensEqual(secret, token)
}

export function cronUnauthorizedResponse() {
  return Response.json(
    {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Internal scheduler authorization failed.',
    },
    { status: 401 },
  )
}

export async function withInternalCronAuth(
  request: Request,
  handler: () => Promise<Response>,
) {
  if (!isInternalCronRequest(request)) return cronUnauthorizedResponse()
  return handler()
}

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

export const ESTIMATE_SHARE_SESSION_COOKIE = 'skillify_estimate_share'
export const ESTIMATE_SHARE_SESSION_TTL_MS = 30 * 60_000

type EstimateShareSessionPayload = {
  version: 1
  publicId: string
  csrfToken: string
  expiresAt: string
}

function signingKey() {
  const raw = process.env.ESTIMATE_SHARE_SIGNING_KEY
  if (!raw) {
    throw new Error(
      'ESTIMATE_SHARE_SIGNING_KEY must be configured for customer Estimate access.',
    )
  }
  const canonicalBase64 =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
  if (!canonicalBase64.test(raw)) {
    throw new Error(
      'ESTIMATE_SHARE_SIGNING_KEY must be valid canonical Base64.',
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.toString('base64') !== raw) {
    throw new Error(
      'ESTIMATE_SHARE_SIGNING_KEY must be valid canonical Base64.',
    )
  }
  if (key.length < 32) {
    throw new Error(
      'ESTIMATE_SHARE_SIGNING_KEY must be a base64-encoded secret containing at least 32 bytes.',
    )
  }
  return key
}

function hmac(purpose: string, value: string) {
  return createHmac('sha256', signingKey())
    .update(`${purpose}:${value}`)
    .digest('base64url')
}

function equal(first: string, second: string) {
  const left = Buffer.from(first, 'utf8')
  const right = Buffer.from(second, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function createEstimateSharePublicId() {
  return randomBytes(32).toString('base64url')
}

export function createSignedEstimateShareToken(publicId: string) {
  return `${publicId}.${hmac('estimate-share-link:v1', publicId)}`
}

export function verifySignedEstimateShareToken(token: string) {
  const separator = token.lastIndexOf('.')
  if (separator <= 0 || separator === token.length - 1) return null
  const publicId = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(publicId)) return null
  const expected = hmac('estimate-share-link:v1', publicId)
  return equal(signature, expected) ? publicId : null
}

export function createEstimateShareSession({
  publicId,
  now = new Date(),
}: {
  publicId: string
  now?: Date
}) {
  const payload: EstimateShareSessionPayload = {
    version: 1,
    publicId,
    csrfToken: randomBytes(24).toString('base64url'),
    expiresAt: new Date(
      now.getTime() + ESTIMATE_SHARE_SESSION_TTL_MS,
    ).toISOString(),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  )
  return {
    value: `${encoded}.${hmac('estimate-share-session:v1', encoded)}`,
    payload,
  }
}

export function verifyEstimateShareSession(
  value: string | undefined,
  now = new Date(),
) {
  if (!value) return null
  const separator = value.lastIndexOf('.')
  if (separator <= 0 || separator === value.length - 1) return null
  const encoded = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  if (!equal(signature, hmac('estimate-share-session:v1', encoded))) {
    return null
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<EstimateShareSessionPayload>
    if (
      payload.version !== 1 ||
      typeof payload.publicId !== 'string' ||
      typeof payload.csrfToken !== 'string' ||
      typeof payload.expiresAt !== 'string' ||
      new Date(payload.expiresAt).getTime() <= now.getTime()
    ) {
      return null
    }
    return payload as EstimateShareSessionPayload
  } catch {
    return null
  }
}

export function csrfTokensEqual(first: string, second: string) {
  return equal(first, second)
}

export function estimatePublicSecurityHeaders() {
  return {
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Content-Security-Policy':
      "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'",
  } as const
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

type RateBucket = { startedAt: number; expiresAt: number; count: number }
const publicRateBuckets = new Map<string, RateBucket>()
const ESTIMATE_PUBLIC_RATE_BUCKET_LIMIT = 4096
const ESTIMATE_PUBLIC_RATE_CLEANUP_INTERVAL_MS = 60_000
let lastPublicRateCleanupAt = 0

function maintainPublicRateBuckets(now: number) {
  if (
    publicRateBuckets.size < ESTIMATE_PUBLIC_RATE_BUCKET_LIMIT &&
    now - lastPublicRateCleanupAt < ESTIMATE_PUBLIC_RATE_CLEANUP_INTERVAL_MS
  ) {
    return
  }
  for (const [key, bucket] of publicRateBuckets) {
    if (bucket.expiresAt <= now) publicRateBuckets.delete(key)
  }
  while (publicRateBuckets.size >= ESTIMATE_PUBLIC_RATE_BUCKET_LIMIT) {
    const oldestKey = publicRateBuckets.keys().next().value
    if (oldestKey === undefined) break
    publicRateBuckets.delete(oldestKey)
  }
  lastPublicRateCleanupAt = now
}

export function checkEstimatePublicRate({
  scope,
  selector,
  limit,
  windowMs = 60_000,
  now = Date.now(),
}: {
  scope: 'exchange' | 'read' | 'decision'
  selector: string
  limit: number
  windowMs?: number
  now?: number
}) {
  const opaqueKey = createHash('sha256')
    .update(`${scope}:${selector}`)
    .digest('hex')
  const current = publicRateBuckets.get(opaqueKey)
  if (!current || current.expiresAt <= now) {
    if (current) publicRateBuckets.delete(opaqueKey)
    maintainPublicRateBuckets(now)
    publicRateBuckets.set(opaqueKey, {
      startedAt: now,
      expiresAt: now + windowMs,
      count: 1,
    })
    return { allowed: true as const }
  }
  if (current.count >= limit) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.expiresAt - now) / 1000),
      ),
    }
  }
  current.count += 1
  return { allowed: true as const }
}

export function clearEstimatePublicRateBucketsForTests() {
  publicRateBuckets.clear()
  lastPublicRateCleanupAt = 0
}

export function estimatePublicRateBucketCountForTests() {
  return publicRateBuckets.size
}

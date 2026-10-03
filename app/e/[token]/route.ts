import { NextRequest, NextResponse } from 'next/server'

import { getPublicEstimate } from '@/lib/estimates/customerExperience'
import {
  checkEstimatePublicRate,
  createEstimateShareSession,
  ESTIMATE_SHARE_SESSION_COOKIE,
  estimatePublicSecurityHeaders,
  verifySignedEstimateShareToken,
} from '@/lib/estimates/customerExperienceSecurity'

type RouteContext = { params: { token: string } }

function unavailable(request: NextRequest, status = 404) {
  return NextResponse.json(
    { ok: false, message: 'This Estimate link is unavailable.' },
    { status, headers: estimatePublicSecurityHeaders() },
  )
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const selector = `${params.token}:${request.headers.get('x-forwarded-for') ?? 'unknown'}`
  const rate = checkEstimatePublicRate({
    scope: 'exchange',
    selector,
    limit: 20,
  })
  if (!rate.allowed) {
    const response = unavailable(request, 429)
    response.headers.set('Retry-After', String(rate.retryAfterSeconds))
    return response
  }
  let publicId: string | null = null
  try {
    publicId = verifySignedEstimateShareToken(decodeURIComponent(params.token))
  } catch {
    publicId = null
  }
  if (!publicId) return unavailable(request)

  const session = createEstimateShareSession({ publicId })
  try {
    await getPublicEstimate({
      publicId,
      csrfToken: session.payload.csrfToken,
    })
  } catch {
    return unavailable(request)
  }

  const response = NextResponse.redirect(
    new URL(`/e/view/${encodeURIComponent(publicId)}`, request.url),
    { headers: estimatePublicSecurityHeaders() },
  )
  response.cookies.set({
    name: ESTIMATE_SHARE_SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.payload.expiresAt),
  })
  return response
}

import { NextRequest, NextResponse } from 'next/server'

import { getPublicEstimate } from '@/lib/estimates/customerExperience'
import {
  checkEstimatePublicRate,
  ESTIMATE_SHARE_SESSION_COOKIE,
  estimatePublicSecurityHeaders,
  verifyEstimateShareSession,
} from '@/lib/estimates/customerExperienceSecurity'

type RouteContext = { params: { publicId: string } }

function unavailable(status = 404) {
  return NextResponse.json(
    { ok: false, message: 'This Estimate link is unavailable.' },
    { status, headers: estimatePublicSecurityHeaders() },
  )
}
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = verifyEstimateShareSession(
    request.cookies.get(ESTIMATE_SHARE_SESSION_COOKIE)?.value,
  )
  if (!session || session.publicId !== params.publicId) return unavailable()
  const rate = checkEstimatePublicRate({
    scope: 'read',
    selector: session.publicId,
    limit: 60,
  })
  if (!rate.allowed) {
    const response = unavailable(429)
    response.headers.set('Retry-After', String(rate.retryAfterSeconds))
    return response
  }
  try {
    const estimate = await getPublicEstimate({
      publicId: session.publicId,
      csrfToken: session.csrfToken,
    })
    return NextResponse.json(
      { ok: true, estimate },
      { headers: estimatePublicSecurityHeaders() },
    )
  } catch {
    return unavailable()
  }
}

import { NextRequest, NextResponse } from 'next/server'

import {
  decidePublicEstimate,
  getPublicEstimate,
} from '@/lib/estimates/customerExperience'
import { EstimateExperienceError } from '@/lib/estimates/customerExperienceError'
import {
  checkEstimatePublicRate,
  csrfTokensEqual,
  ESTIMATE_SHARE_SESSION_COOKIE,
  estimatePublicSecurityHeaders,
  hasSameOrigin,
  verifyEstimateShareSession,
} from '@/lib/estimates/customerExperienceSecurity'

type RouteContext = { params: { publicId: string } }

function response(
  body: Record<string, unknown>,
  status: number,
  retryAfter?: number,
) {
  const result = NextResponse.json(body, {
    status,
    headers: estimatePublicSecurityHeaders(),
  })
  if (retryAfter) result.headers.set('Retry-After', String(retryAfter))
  return result
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!hasSameOrigin(request)) {
    return response({ ok: false, message: 'Invalid request origin.' }, 403)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 8192) {
    return response({ ok: false, message: 'Request body is too large.' }, 413)
  }
  const session = verifyEstimateShareSession(
    request.cookies.get(ESTIMATE_SHARE_SESSION_COOKIE)?.value,
  )
  if (!session || session.publicId !== params.publicId) {
    return response(
      { ok: false, message: 'This Estimate link is unavailable.' },
      404,
    )
  }
  const rate = checkEstimatePublicRate({
    scope: 'decision',
    selector: session.publicId,
    limit: 10,
  })
  if (!rate.allowed) {
    return response(
      { ok: false, message: 'Too many attempts. Try again shortly.' },
      429,
      rate.retryAfterSeconds,
    )
  }
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (
      typeof body.csrfToken !== 'string' ||
      !csrfTokensEqual(body.csrfToken, session.csrfToken)
    ) {
      return response({ ok: false, message: 'Invalid CSRF token.' }, 403)
    }
    const result = await decidePublicEstimate({
      publicId: session.publicId,
      rawInput: body,
    })
    const estimate = await getPublicEstimate({
      publicId: session.publicId,
      csrfToken: session.csrfToken,
    })
    return response({ ok: true, estimate, replayed: result.replayed }, 200)
  } catch (error) {
    if (error instanceof EstimateExperienceError) {
      return response(
        {
          ok: false,
          code: error.code,
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
        error.status,
      )
    }
    return response(
      { ok: false, message: 'The Estimate decision could not be recorded.' },
      500,
    )
  }
}

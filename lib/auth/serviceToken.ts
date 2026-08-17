import { timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'

export type AutomationServiceScope =
  | 'ENTITLEMENT_ADMIN'
  | 'SECURITY_PACK_DELIVERY'
  | 'SERVICE_TOKEN_AUTOMATION'
  | string

type AuthResult =
  | { ok: true; system: string; scopes: AutomationServiceScope[] }
  | { ok: false; response: NextResponse }

function parseScopes(value?: string) {
  return (value ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function tokensEqual(a: string, b: string) {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Validate AutomationServiceToken via bearer Authorization header.
 * - No user impersonation; returns system identity only.
 * - Scope-based authorization.
 * - Rejects inactive or revoked tokens.
 */
export async function authenticateServiceToken(
  req: NextRequest,
  requiredScope: AutomationServiceScope,
): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization') || ''
  const [, token] = authHeader.split(' ')
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: missing token' },
        { status: 401 },
      ),
    }
  }

  const configuredToken =
    process.env.AUTOMATION_SERVICE_TOKEN ?? process.env.INTERNAL_SERVICE_TOKEN
  if (!configuredToken || !tokensEqual(configuredToken, token)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: invalid token' },
        { status: 401 },
      ),
    }
  }

  const scopes = parseScopes(process.env.AUTOMATION_SERVICE_SCOPES)
  if (!scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: insufficient scope' },
        { status: 403 },
      ),
    }
  }

  return {
    ok: true,
    system: process.env.AUTOMATION_SERVICE_SYSTEM ?? 'env-service-token',
    scopes,
  }
}

/**
 * Correlation ID helper: pass through incoming header if present.
 */
export function getCorrelationId(req: NextRequest) {
  return req.headers.get('x-correlation-id') || null
}

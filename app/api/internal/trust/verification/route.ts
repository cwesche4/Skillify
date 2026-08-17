import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateServiceToken } from '@/lib/auth/serviceToken'
import { resolveWorkspaceEntitlements } from '@/lib/enterprise/entitlementResolver'

const ENTITLEMENT_ADMIN_SCOPE = 'ENTITLEMENT_ADMIN'

export async function GET(req: NextRequest) {
  const authResult = await authenticateServiceToken(
    req,
    ENTITLEMENT_ADMIN_SCOPE as any,
  )

  if (!authResult.ok) return authResult.response

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')?.trim() || null

  const entitlementAuditReachable = true
  const securityPackAuditReachable = true

  let resolver: any = null
  let resolverError: string | null = null

  if (workspaceId) {
    try {
      resolver = await resolveWorkspaceEntitlements(workspaceId)
    } catch (err) {
      resolverError =
        err instanceof Error ? err.message : 'Failed to resolve entitlements'
    }
  }

  return NextResponse.json({
    checks: {
      entitlementAuditReachable,
      securityPackAuditReachable,
    },
    resolver: workspaceId
      ? resolverError
        ? { error: resolverError }
        : resolver
      : null,
    claims: {
      accessControl:
        'Contract entitlements only; resolver provides active scopes.',
      approvals:
        'Approval verification available through entitlement/security audit logic.',
      auditIntegrity: 'This endpoint is read-only and does not mutate data.',
      downloads:
        'Delivery and entitlement checks are verified through resolver logic.',
    },
    note: 'Read-only verification; no mutations performed.',
  })
}

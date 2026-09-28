import { NextResponse, type NextRequest } from 'next/server'
import { authenticateServiceToken } from '@/lib/auth/serviceToken'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authorization = await authenticateServiceToken(
    request,
    'AUTOMATION_OPERATIONS',
  )
  if (!authorization.ok) return authorization.response

  const [lastAudit, lastRateLimit, lastAlert] = await Promise.all([
    prisma.aiActionAudit.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.aiActionAudit.findFirst({
      where: { reason: 'rate_limited' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.aiActionAudit.findFirst({
      where: {
        reason: {
          in: [
            'ai_actions_disabled',
            'not_workspace_member',
            'conflict_detected',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  return NextResponse.json({
    lastAuditAt: lastAudit?.createdAt?.toISOString() ?? null,
    lastRateLimitAt: lastRateLimit?.createdAt?.toISOString() ?? null,
    lastAlertAt: lastAlert?.createdAt?.toISOString() ?? null,
  })
}

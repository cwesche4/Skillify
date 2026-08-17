import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
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

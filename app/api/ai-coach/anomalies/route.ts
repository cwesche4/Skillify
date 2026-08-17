import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { RunStatus } from '@/lib/prisma/enums'
import { assertAiActionsEnabled } from '@/lib/builder/ai/server/assertAiActionsEnabled'
import { buildAiMetric, emitAiMetric } from '@/lib/observability/aiMetrics'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  const aiGuard = await assertAiActionsEnabled(workspaceId)
  if (aiGuard) return aiGuard
  emitAiMetric(
    buildAiMetric({
      name: 'ai_action_attempted',
      workspaceId: workspaceId ?? 'unknown',
      action: 'ai_coach_anomalies',
      result: 'applied',
    }),
  )

  const whereBase = workspaceId ? { workspaceId } : {}

  const recentFailed = await prisma.automationRun.findMany({
    where: {
      ...whereBase,
      status: 'FAILED' satisfies RunStatus,
      startedAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
    include: {
      automation: { select: { name: true } },
    },
  })

  const anomalies = recentFailed.map((run: any) => ({
    id: run.id,
    message: `Automation "${run.automation?.name ?? run.automationId}" failed.`,
    severity: 'medium' as const,
    time: run.startedAt.toISOString(),
  }))

  return NextResponse.json({ anomalies })
}

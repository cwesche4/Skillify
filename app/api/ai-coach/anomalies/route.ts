// app/api/ai-coach/anomalies/route.ts
import { RunStatus } from '@prisma/client'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  const whereBase = workspaceId ? { workspaceId } : {}

  const recentFailed = await prisma.automationRun.findMany({
    where: {
      ...whereBase,
      status: RunStatus.FAILED,
      startedAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 6), // last 6 hours
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
    include: {
      automation: { select: { name: true } },
    },
  })

  const anomalies = recentFailed.map((run) => ({
    id: run.id,
    message: `Automation "${run.automation?.name ?? run.automationId}" failed.`,
    severity: 'medium' as const,
    time: run.startedAt.toISOString(),
  }))

  return NextResponse.json({ anomalies })
}

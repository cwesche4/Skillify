import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { AutomationStatus, RunStatus } from '@/lib/prisma/enums'

export async function GET() {
  // Admin guard
  const user = await currentUser()
  const role = (user?.publicMetadata as any)?.role

  if (!user || role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = Date.now()
  const since24h = new Date(now - 24 * 60 * 60 * 1000)

  const [
    userCount,
    workspaceCount,
    automationCount,
    activeAutomationCount,
    runCount,
    failedRunCount,
    runsLast24h,
  ] = await prisma.$transaction([
    prisma.userProfile.count(),
    prisma.workspace.count(),
    prisma.automation.count(),
    prisma.automation.count({
      where: { status: 'ACTIVE' satisfies AutomationStatus },
    }),
    prisma.automationRun.count(),
    prisma.automationRun.count({
      where: { status: 'FAILED' satisfies RunStatus },
    }),
    prisma.automationRun.count({
      where: { startedAt: { gte: since24h } },
    }),
  ])

  const recentRuns = await prisma.automationRun.findMany({
    take: 10,
    orderBy: { startedAt: 'desc' },
    include: {
      automation: {
        select: {
          name: true,
          workspace: { select: { name: true, slug: true } },
        },
      },
    },
  })

  const failureRate = runCount === 0 ? 0 : (failedRunCount / runCount) * 100

  return NextResponse.json({
    userCount,
    workspaceCount,
    automationCount,
    activeAutomationCount,
    runCount,
    failedRunCount,
    runsLast24h,
    failureRate,
    recentRuns: recentRuns.map((r: any) => ({
      id: r.id,
      automationName: r.automation?.name ?? 'Unknown',
      workspaceName: r.automation?.workspace?.name ?? 'Unknown',
      workspaceSlug: r.automation?.workspace?.slug ?? '',
      status: r.status,
      startedAt: r.startedAt.toISOString(),
    })),
  })
}

import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspace = searchParams.get('workspace') ?? 'skillify-hq'

  try {
    const activeAutomations = await prisma.automation.count({
      where: {
        workspaceId: workspace,
        status: 'ACTIVE', // ← FIXED
      },
    })

    const totalRuns = await prisma.automationRun.count({
      where: { workspaceId: workspace },
    })

    const todayRuns = await prisma.automationRun.count({
      where: {
        workspaceId: workspace,
        startedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    })

    const lastRun = await prisma.automationRun.findFirst({
      where: { workspaceId: workspace },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json({
      workspace,
      todayRuns,
      totalRuns,
      activeAutomations,
      lastRunAt: lastRun?.startedAt ?? null,
    })
  } catch (e) {
    console.error('SUMMARY ERROR:', e)
    return NextResponse.json(
      { error: 'Failed to load analytics' },
      { status: 500 },
    )
  }
}

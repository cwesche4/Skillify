import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspace = searchParams.get('workspace')
  if (!workspace) {
    return NextResponse.json(
      { error: 'workspace is required' },
      { status: 400 },
    )
  }

  const access = await authorizeWorkspaceAccess({
    workspaceId: workspace,
    access: 'manage',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

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
      select: { startedAt: true },
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

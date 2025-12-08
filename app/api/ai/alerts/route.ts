import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Narrow type for the fields we actually use in this handler
type RunSample = {
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  durationMs: number | null
  workspaceId: string
}

export async function GET() {
  const { userId } = auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  // recent 100 runs across all workspaces the user belongs to
  const runs: RunSample[] = await prisma.automationRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 100,
    select: {
      status: true,
      durationMs: true,
      workspaceId: true,
    },
  })

  const alerts: string[] = []

  const failures = runs.filter((r) => r.status === 'FAILED').length
  const failRate = runs.length > 0 ? (failures / runs.length) * 100 : 0

  if (failRate > 20) {
    alerts.push(
      `⚠️ Failure rate has risen to ${failRate.toFixed(1)}% in recent runs.`,
    )
  }

  const slow = runs.filter((r) => (r.durationMs ?? 0) > 2000).length
  if (slow > 10) {
    alerts.push(
      `⚠️ Unusual number of slow runs detected (>${slow} runs exceeding 2s).`,
    )
  }

  if (alerts.length === 0) {
    alerts.push('Your automations appear healthy — no anomalies detected.')
  }

  return NextResponse.json({ alerts })
}

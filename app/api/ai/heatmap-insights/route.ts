import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { workspaceId } = await req.json()

  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    orderBy: { startedAt: 'desc' },
    take: 200,
  })

  type RunInfo = {
    status: string
    durationMs: number | null
  }

  const total = runs.length
  const failures = runs.filter((r: RunInfo) => r.status === 'FAILED').length
  const failRate = (failures / total) * 100

  const insights = [
    `Workspace has ${total} recent runs with a failure rate of ${failRate.toFixed(
      1,
    )}%.`,
  ]

  if (failRate > 15) {
    insights.push(
      'Heatmap shows concentrated failure zones — investigate these automations.',
    )
  }

  const long = runs.filter((r: RunInfo) => (r.durationMs ?? 0) > 3000).length
  if (long > 5) {
    insights.push(
      'Several flows are running slowly — may indicate external API bottlenecks.',
    )
  }

  return NextResponse.json({ insights })
}

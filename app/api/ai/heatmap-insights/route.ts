// app/api/ai/heatmap-insights/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlan } from '@/lib/auth/route-guard'

export async function POST(req: Request) {
  const { workspaceId } = await req.json()

  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
  }

  // 🔒 Pro+ only (analytics.heatmap)
  await requirePlan('Pro', workspaceId)

  const runs = await prisma.automationRun.findMany({
    where: { workspaceId },
    orderBy: { startedAt: 'desc' },
    take: 200,
  })

  const total = runs.length

  if (total === 0) {
    return NextResponse.json({
      insights: [
        'No recent runs yet. Trigger some automations to see insights.',
      ],
    })
  }

  const failures = runs.filter((r: any) => r.status === 'FAILED').length
  const failRate = (failures / total) * 100

  const insights: string[] = [
    `Workspace has ${total} recent runs with a failure rate of ${failRate.toFixed(
      1,
    )}%.`,
  ]

  if (failRate > 15) {
    insights.push(
      'Heatmap shows concentrated failure zones — investigate automations with repeated failures or recent changes.',
    )
  }

  const long = runs.filter((r: any) => (r.durationMs ?? 0) > 3000).length
  if (long > 5) {
    insights.push(
      'Several flows are running slowly — this may indicate external API bottlenecks or long-running AI calls.',
    )
  }

  return NextResponse.json({ insights })
}

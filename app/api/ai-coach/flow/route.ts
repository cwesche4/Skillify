// app/api/ai-coach/flow/route.ts
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
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
      action: 'ai_coach_flow',
      result: 'applied',
    }),
  )

  const where = workspaceId ? { workspaceId } : {}

  // For now, pick the most recently updated automations as "slow candidates".
  const automations = await prisma.automation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    slowNodes: automations.map((a: any) => ({
      node: a.name ?? 'Automation',
      duration: 'N/A',
    })),
    suggestions: [
      'Use streaming output for LLM-heavy flows.',
      'Split large automations into smaller, specialized flows.',
    ],
  })
}

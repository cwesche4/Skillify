// app/api/ai-coach/cost/route.ts
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { assertAiActionsEnabled } from '@/lib/builder/ai/server/assertAiActionsEnabled'
import { buildAiMetric, emitAiMetric } from '@/lib/observability/aiMetrics'
import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 },
    )
  }

  const access = await authorizeWorkspaceAccess({
    workspaceId,
    access: 'view',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const aiGuard = await assertAiActionsEnabled(workspaceId)
  if (aiGuard) return aiGuard
  emitAiMetric(
    buildAiMetric({
      name: 'ai_action_attempted',
      workspaceId: workspaceId ?? 'unknown',
      action: 'ai_coach_cost',
      result: 'applied',
    }),
  )

  // Placeholder: in the future derive cost from node metadata / token usage.
  const aiNodesCount = await prisma.automation.count({
    where: { workspaceId },
  })

  const estimatedMonthlyCost = aiNodesCount * 3.5 // Totally arbitrary placeholder

  return NextResponse.json({
    monthlyCost: estimatedMonthlyCost,
    currency: 'USD',
    topExpensive: [],
    suggestions: [
      'Shorten prompts for AI LLM nodes.',
      'Batch similar requests to reduce overhead.',
    ],
  })
}

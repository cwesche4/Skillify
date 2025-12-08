// app/api/ai-coach/cost/route.ts
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  const where = workspaceId ? { workspaceId } : {}

  // Placeholder: in the future derive cost from node metadata / token usage.
  const aiNodesCount = await prisma.automation.count({
    where,
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

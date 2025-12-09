// app/api/ai-coach/flow/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface AutomationLite {
  id: string
  name: string | null
  updatedAt: Date
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  const where = workspaceId ? { workspaceId } : {}

  // Select only needed fields
  const automations: AutomationLite[] = await prisma.automation.findMany({
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
    slowNodes: automations.map((a: AutomationLite) => ({
      node: a.name ?? 'Automation',
      duration: 'N/A',
    })),
    suggestions: [
      'Use streaming output for LLM-heavy flows.',
      'Split large automations into smaller, specialized flows.',
    ],
  })
}

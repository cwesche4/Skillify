import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../_lib'
import { prisma } from '@/lib/db'
import { detectWorkspaceKnowledgeConflicts } from '@/lib/intelligence/workspaceKnowledgeGovernance'

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  try {
    const body = await request.json()
    const statement =
      typeof body.statement === 'string'
        ? body.statement.replace(/\s+/g, ' ').trim()
        : ''
    const category =
      typeof body.category === 'string' ? body.category.trim() : ''

    if (!statement || !category) {
      return NextResponse.json({ conflicts: [] })
    }

    const approved = await (prisma as any).workspaceKnowledgeItem.findMany({
      where: {
        workspaceId: actor.workspaceId,
        isArchived: false,
        approvalStatus: 'APPROVED',
      },
      select: {
        id: true,
        title: true,
        category: true,
        approvalStatus: true,
        structuredValue: true,
        updatedAt: true,
      },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    })

    const conflicts = detectWorkspaceKnowledgeConflicts({
      proposed: {
        id: 'proposed',
        title: statement,
        category,
        structuredValue: body.structuredValue,
      },
      approved,
    })

    const exactMatches = approved
      .filter(
        (match: any) =>
          match.title === statement && match.category === category,
      )
      .map((match: any) => ({
        existingId: match.id,
        existingPolicy: match.title,
        proposedPolicy: statement,
        potentialImpact:
          'Exact approved knowledge already exists for this category.',
      }))

    return NextResponse.json({
      conflicts: [...exactMatches, ...conflicts].slice(0, 5),
    })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

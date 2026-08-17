import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../../_lib'
import { restoreWorkspaceKnowledgeItem } from '@/lib/intelligence/workspaceKnowledgeStore'

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string; knowledgeId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId, [
    'owner',
    'admin',
  ])
  if (!actor) return response

  try {
    const body = await request.json().catch(() => ({}))
    const item = await restoreWorkspaceKnowledgeItem({
      actor,
      knowledgeItemId: params.knowledgeId,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    })

    return NextResponse.json({ item })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

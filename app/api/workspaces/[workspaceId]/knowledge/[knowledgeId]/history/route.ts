import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../../_lib'
import { listWorkspaceKnowledgeHistory } from '@/lib/intelligence/workspaceKnowledgeStore'

export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string; knowledgeId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  try {
    const revisions = await listWorkspaceKnowledgeHistory({
      workspaceId: actor.workspaceId,
      knowledgeItemId: params.knowledgeId,
    })

    return NextResponse.json({ revisions })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

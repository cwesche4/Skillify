import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../../_lib'
import { approveWorkspaceKnowledgeItem } from '@/lib/intelligence/workspaceKnowledgeStore'

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
    const body = await safeJson(request)
    const item = await approveWorkspaceKnowledgeItem({
      actor,
      knowledgeItemId: params.knowledgeId,
      reason: typeof body?.reason === 'string' ? body.reason : undefined,
    })

    return NextResponse.json({ item })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

async function safeJson(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../_lib'
import {
  archiveWorkspaceKnowledgeItem,
  getWorkspaceKnowledgeItem,
  updateWorkspaceKnowledgeItem,
} from '@/lib/intelligence/workspaceKnowledgeStore'

export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string; knowledgeId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  try {
    const item = await getWorkspaceKnowledgeItem({
      workspaceId: actor.workspaceId,
      knowledgeItemId: params.knowledgeId,
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Workspace knowledge item not found.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ item })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceId: string; knowledgeId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  try {
    const item = await updateWorkspaceKnowledgeItem({
      actor,
      knowledgeItemId: params.knowledgeId,
      input: await request.json(),
    })

    return NextResponse.json({ item })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

export async function DELETE(
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
    const item = await archiveWorkspaceKnowledgeItem({
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

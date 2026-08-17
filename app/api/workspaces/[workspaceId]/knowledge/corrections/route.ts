import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../_lib'
import {
  createWorkspaceKnowledgeCorrection,
  loadPersistedWorkspaceKnowledgeSnapshot,
} from '@/lib/intelligence/workspaceKnowledgeStore'

export async function GET(
  _request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  try {
    const snapshot = await loadPersistedWorkspaceKnowledgeSnapshot({
      workspaceId: actor.workspaceId,
    })
    return NextResponse.json({ corrections: snapshot.corrections })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  try {
    const body = await request.json()
    const correction = await createWorkspaceKnowledgeCorrection({
      actor,
      correctionText: body.correctionText,
      knowledgeItemId:
        typeof body.knowledgeItemId === 'string'
          ? body.knowledgeItemId
          : undefined,
      correctedValue: body.correctedValue,
      sourceDomain:
        typeof body.sourceDomain === 'string' ? body.sourceDomain : undefined,
      targetCategory:
        typeof body.targetCategory === 'string'
          ? body.targetCategory
          : undefined,
    })

    return NextResponse.json({ correction }, { status: 201 })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

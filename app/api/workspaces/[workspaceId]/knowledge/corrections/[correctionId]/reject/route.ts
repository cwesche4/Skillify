import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../../../_lib'
import { rejectWorkspaceKnowledgeCorrection } from '@/lib/intelligence/workspaceKnowledgeStore'

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string; correctionId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId, [
    'owner',
    'admin',
  ])
  if (!actor) return response

  try {
    const body = await request.json()
    const correction = await rejectWorkspaceKnowledgeCorrection({
      actor,
      correctionId: params.correctionId,
      reason: typeof body.reason === 'string' ? body.reason : '',
    })

    return NextResponse.json({ correction })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

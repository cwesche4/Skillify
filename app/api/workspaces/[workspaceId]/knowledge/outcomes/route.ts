import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../_lib'
import {
  loadPersistedWorkspaceKnowledgeSnapshot,
  recordWorkspaceRecommendationOutcome,
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
    return NextResponse.json({ outcomes: snapshot.recommendationHistory })
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
    const outcome = await recordWorkspaceRecommendationOutcome({
      actor,
      recommendationId: body.recommendationId,
      recommendationType: body.recommendationType,
      recommendationTitle: body.recommendationTitle,
      outcome: body.outcome,
      sourceDomain:
        typeof body.sourceDomain === 'string' ? body.sourceDomain : undefined,
      targetRecordType:
        typeof body.targetRecordType === 'string'
          ? body.targetRecordType
          : undefined,
      targetRecordId:
        typeof body.targetRecordId === 'string'
          ? body.targetRecordId
          : undefined,
      confidenceAtDecision:
        typeof body.confidenceAtDecision === 'string'
          ? body.confidenceAtDecision
          : undefined,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      metadata: isRecord(body.metadata) ? body.metadata : undefined,
    })

    return NextResponse.json({ outcome }, { status: 201 })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

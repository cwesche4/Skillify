import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../_lib'
import {
  loadPersistedWorkspaceKnowledgeSnapshot,
  persistWorkspaceConfidenceAssessment,
} from '@/lib/intelligence/workspaceKnowledgeStore'
import type { WorkspaceConfidenceAssessment } from '@/lib/intelligence/workspaceKnowledgeGrowth'

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
    return NextResponse.json({
      confidence: snapshot.confidence,
      confidenceAssessments: snapshot.confidenceAssessments,
    })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId, [
    'owner',
    'admin',
    'manager',
  ])
  if (!actor) return response

  try {
    const body = await request.json()
    const assessment = await persistWorkspaceConfidenceAssessment({
      workspaceId: actor.workspaceId,
      scope: body.scope,
      assessment: body.assessment as WorkspaceConfidenceAssessment,
      metadata: isRecord(body.metadata) ? body.metadata : undefined,
    })

    return NextResponse.json({ assessment }, { status: 201 })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

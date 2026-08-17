import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from '../_lib'
import {
  loadPersistedWorkspaceKnowledgeSnapshot,
  upsertWorkspaceKnowledgeGap,
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
    return NextResponse.json({ gaps: snapshot.knowledgeGaps })
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
    const gap = await upsertWorkspaceKnowledgeGap({
      workspaceId: actor.workspaceId,
      category: body.category,
      title: body.title,
      description: body.description,
      severity: body.severity,
      affectedDomains: Array.isArray(body.affectedDomains)
        ? body.affectedDomains
        : [],
      source: typeof body.source === 'string' ? body.source : undefined,
      metadata: isRecord(body.metadata) ? body.metadata : undefined,
    })

    return NextResponse.json({ gap }, { status: 201 })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

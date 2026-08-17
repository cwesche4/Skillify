import { NextResponse, type NextRequest } from 'next/server'

import { knowledgeErrorResponse, requireKnowledgeActor } from './_lib'
import {
  createWorkspaceKnowledgeItem,
  listWorkspaceKnowledgeItems,
} from '@/lib/intelligence/workspaceKnowledgeStore'

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { actor, response } = await requireKnowledgeActor(params.workspaceId)
  if (!actor) return response

  const searchParams = request.nextUrl.searchParams

  try {
    const items = await listWorkspaceKnowledgeItems({
      workspaceId: actor.workspaceId,
      approvalStatus: normalizeApprovalStatus(searchParams.get('status')),
      category: searchParams.get('category') ?? undefined,
      query: searchParams.get('q') ?? undefined,
      includeArchived: searchParams.get('includeArchived') === 'true',
      limit: normalizeLimit(searchParams.get('limit')),
    })

    return NextResponse.json({ items })
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
    const item = await createWorkspaceKnowledgeItem({
      actor,
      input: await request.json(),
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return knowledgeErrorResponse(error)
  }
}

function normalizeApprovalStatus(value: string | null) {
  const normalized = value?.toUpperCase()
  return normalized === 'DRAFT' ||
    normalized === 'PENDING_REVIEW' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED' ||
    normalized === 'ARCHIVED' ||
    normalized === 'SUPERSEDED'
    ? normalized
    : undefined
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return 100
  return Math.min(Math.max(parsed, 1), 250)
}

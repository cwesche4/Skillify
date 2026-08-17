import { NextResponse, type NextRequest } from 'next/server'

import {
  createWorkspaceTeam,
  listWorkspaceTeams,
} from '@/lib/workspaceStructure/teams'
import {
  getWorkspaceStructureActor,
  isWorkspaceStructureResponse,
  workspaceStructureErrorResponse,
} from '../_lib/workspace-structure-auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    const includeArchived =
      request.nextUrl.searchParams.get('includeArchived') === 'true'
    const teams = await listWorkspaceTeams({
      workspaceId: params.workspaceId,
      includeArchived,
    })
    return NextResponse.json({ ok: true, teams })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    const body = await request.json()
    const team = await createWorkspaceTeam({
      actor,
      input: body.team ?? body,
    })
    return NextResponse.json({ ok: true, team }, { status: 201 })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

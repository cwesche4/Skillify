import { NextResponse, type NextRequest } from 'next/server'

import {
  archiveWorkspaceTeam,
  restoreWorkspaceTeam,
  updateWorkspaceTeam,
} from '@/lib/workspaceStructure/teams'
import {
  getWorkspaceStructureActor,
  isWorkspaceStructureResponse,
  workspaceStructureErrorResponse,
} from '../../_lib/workspace-structure-auth'

type RouteContext = { params: { workspaceId: string; teamId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    const body = await request.json()
    if (body.action === 'archive') {
      await archiveWorkspaceTeam({ actor, teamId: params.teamId })
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'restore') {
      await restoreWorkspaceTeam({ actor, teamId: params.teamId })
      return NextResponse.json({ ok: true })
    }
    const team = await updateWorkspaceTeam({
      actor,
      teamId: params.teamId,
      input: body.team ?? body,
    })
    return NextResponse.json({ ok: true, team })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    await archiveWorkspaceTeam({ actor, teamId: params.teamId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

import { NextResponse, type NextRequest } from 'next/server'

import {
  archiveWorkspaceLocation,
  restoreWorkspaceLocation,
  updateWorkspaceLocation,
} from '@/lib/workspaceStructure/locations'
import {
  getWorkspaceStructureActor,
  isWorkspaceStructureResponse,
  workspaceStructureErrorResponse,
} from '../../_lib/workspace-structure-auth'

type RouteContext = { params: { workspaceId: string; locationId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    const body = await request.json()
    if (body.action === 'archive') {
      await archiveWorkspaceLocation({ actor, locationId: params.locationId })
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'restore') {
      await restoreWorkspaceLocation({ actor, locationId: params.locationId })
      return NextResponse.json({ ok: true })
    }
    const location = await updateWorkspaceLocation({
      actor,
      locationId: params.locationId,
      input: body.location ?? body,
    })
    return NextResponse.json({ ok: true, location })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    await archiveWorkspaceLocation({ actor, locationId: params.locationId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

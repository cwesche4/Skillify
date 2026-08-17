import { NextResponse, type NextRequest } from 'next/server'

import {
  createWorkspaceLocation,
  listWorkspaceLocations,
} from '@/lib/workspaceStructure/locations'
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
    const locations = await listWorkspaceLocations({
      workspaceId: params.workspaceId,
      includeArchived,
    })
    return NextResponse.json({ ok: true, locations })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await getWorkspaceStructureActor(params.workspaceId)
    if (isWorkspaceStructureResponse(actor)) return actor

    const body = await request.json()
    const location = await createWorkspaceLocation({
      actor,
      input: body.location ?? body,
    })
    return NextResponse.json({ ok: true, location }, { status: 201 })
  } catch (error) {
    return workspaceStructureErrorResponse(error)
  }
}

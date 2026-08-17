import { type NextRequest } from 'next/server'
import {
  CalendarConnectionOwnershipType,
  CalendarConnectionPurpose,
} from '@prisma/client'

import { connectCalDavCalendar } from '@/lib/scheduling/providers/caldavService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    const ownershipType =
      body?.ownershipType === 'WORKSPACE'
        ? CalendarConnectionOwnershipType.WORKSPACE
        : CalendarConnectionOwnershipType.MEMBER
    if (
      ownershipType === CalendarConnectionOwnershipType.WORKSPACE &&
      !actor.canManageScheduling
    ) {
      return Response.json(
        {
          ok: false,
          code: 'FORBIDDEN',
          message: 'Only workspace admins can connect shared CalDAV accounts.',
        },
        { status: 403 },
      )
    }
    const requestedPurpose =
      typeof body?.connectionPurpose === 'string' &&
      body.connectionPurpose in CalendarConnectionPurpose
        ? (body.connectionPurpose as CalendarConnectionPurpose)
        : undefined
    return schedulingApiSuccess(
      await connectCalDavCalendar({
        workspaceId: params.workspaceId,
        actorUserId: actor.actorUserId,
        actorWorkspaceMemberId: actor.workspaceMemberId,
        ownershipType,
        requestedPurpose,
        platform:
          typeof body?.platform === 'string' ? body.platform : undefined,
        serverUrl:
          typeof body?.serverUrl === 'string' ? body.serverUrl : undefined,
        username:
          typeof body?.username === 'string' ? body.username : undefined,
        password:
          typeof body?.password === 'string' ? body.password : undefined,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

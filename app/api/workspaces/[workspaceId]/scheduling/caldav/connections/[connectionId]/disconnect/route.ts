import { type NextRequest } from 'next/server'

import { disconnectCalDavConnection } from '@/lib/scheduling/providers/caldavService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  canManageCalendarConnection,
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; connectionId: string } }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (
    !(await canManageCalendarConnection(
      params.workspaceId,
      params.connectionId,
      actor,
    ))
  ) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    return schedulingApiSuccess(
      await disconnectCalDavConnection({
        workspaceId: params.workspaceId,
        connectionId: params.connectionId,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

import { type NextRequest } from 'next/server'

import { syncGoogleCalendarConnection } from '@/lib/scheduling/providers/googleService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  canManageCalendarConnection,
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; connectionId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const body = await request.json().catch(() => ({}))
    return schedulingApiSuccess(
      await syncGoogleCalendarConnection({
        workspaceId: params.workspaceId,
        connectionId: params.connectionId,
        dryRun: body.dryRun === true,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

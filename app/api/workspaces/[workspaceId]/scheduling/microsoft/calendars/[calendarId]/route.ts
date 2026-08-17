import { type NextRequest } from 'next/server'
import { CalendarConnectionPurpose } from '@prisma/client'

import { updateConnectedMicrosoftCalendar } from '@/lib/scheduling/providers/microsoftService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  canManageConnectedCalendar,
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; calendarId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (
    !(await canManageConnectedCalendar(
      params.workspaceId,
      params.calendarId,
      actor,
    ))
  ) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    return schedulingApiSuccess(
      await updateConnectedMicrosoftCalendar({
        workspaceId: params.workspaceId,
        calendarId: params.calendarId,
        selectedForSync:
          typeof body.selectedForSync === 'boolean'
            ? body.selectedForSync
            : undefined,
        syncDirection:
          typeof body.syncDirection === 'string'
            ? body.syncDirection
            : undefined,
        defaultExportTarget:
          typeof body.defaultExportTarget === 'boolean'
            ? body.defaultExportTarget
            : undefined,
        calendarPurpose:
          typeof body.calendarPurpose === 'string' &&
          body.calendarPurpose in CalendarConnectionPurpose
            ? (body.calendarPurpose as CalendarConnectionPurpose)
            : undefined,
        actorWorkspaceMemberId: actor.workspaceMemberId,
        canManageScheduling: actor.canManageScheduling,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

import { CalendarConnectionPurpose } from '@prisma/client'

import {
  confirmCalendarConnectionClassification,
  disconnectUnconfirmedCalendarConnection,
} from '@/lib/scheduling/providers/calendarGovernance'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; connectionId: string } }

export async function POST(request: Request, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    if (body?.action === 'cancel') {
      const connection = await disconnectUnconfirmedCalendarConnection({
        workspaceId: params.workspaceId,
        connectionId: params.connectionId,
        actorMemberId: actor.workspaceMemberId,
      })
      return schedulingApiSuccess({ connection })
    }
    const selectedPurpose =
      typeof body?.purpose === 'string' &&
      body.purpose in CalendarConnectionPurpose
        ? (body.purpose as CalendarConnectionPurpose)
        : null
    if (!selectedPurpose) {
      return Response.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Choose a valid calendar type.',
        },
        { status: 400 },
      )
    }
    const connection = await confirmCalendarConnectionClassification({
      workspaceId: params.workspaceId,
      connectionId: params.connectionId,
      actorMemberId: actor.workspaceMemberId,
      selectedPurpose,
    })
    return schedulingApiSuccess({ connection })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

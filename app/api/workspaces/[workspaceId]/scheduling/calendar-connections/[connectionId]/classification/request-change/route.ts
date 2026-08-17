import { updateCalendarConnectionApproval } from '@/lib/scheduling/providers/calendarGovernance'
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
  if (!actor.canManageScheduling) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const connection = await updateCalendarConnectionApproval({
      workspaceId: params.workspaceId,
      connectionId: params.connectionId,
      action: 'requestChanges',
      actorMemberId: actor.workspaceMemberId,
      reason: typeof body?.reason === 'string' ? body.reason : undefined,
    })
    return schedulingApiSuccess({ connection })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

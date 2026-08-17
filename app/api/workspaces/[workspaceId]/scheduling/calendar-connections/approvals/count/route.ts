import { countActionRequiredCalendarApprovals } from '@/lib/scheduling/providers/calendarGovernance'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(_request: Request, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const count = await countActionRequiredCalendarApprovals(params.workspaceId)
    return schedulingApiSuccess({ count })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

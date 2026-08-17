import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { inspectGoogleCalendarMappingIntegrity } from '@/lib/scheduling/providers/googleService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function POST(request: Request, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return schedulingErrorResponse({
      status: 403,
      message: 'You do not have permission to repair Google Calendar mappings.',
    })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const result = await inspectGoogleCalendarMappingIntegrity({
      workspaceId: params.workspaceId,
      repair: body.repair === true,
    })
    return schedulingApiSuccess(result.value)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

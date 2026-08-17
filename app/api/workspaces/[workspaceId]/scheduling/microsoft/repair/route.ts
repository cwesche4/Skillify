import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { inspectMicrosoftCalendarMappingIntegrity } from '@/lib/scheduling/providers/microsoftService'
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
      message:
        'You do not have permission to repair Microsoft Outlook mappings.',
    })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const result = await inspectMicrosoftCalendarMappingIntegrity({
      workspaceId: params.workspaceId,
      repair: body.repair === true,
    })
    return schedulingApiSuccess(result.value)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

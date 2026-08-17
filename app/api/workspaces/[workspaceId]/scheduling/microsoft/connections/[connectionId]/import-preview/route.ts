import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { previewMicrosoftCalendarInitialSync } from '@/lib/scheduling/providers/microsoftService'
import {
  canManageCalendarConnection,
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../../_lib/auth'

type RouteContext = {
  params: { workspaceId: string; connectionId: string }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (
    !(await canManageCalendarConnection(
      params.workspaceId,
      params.connectionId,
      actor,
    ))
  ) {
    return schedulingErrorResponse({
      status: 403,
      message: 'You do not have permission to manage Microsoft Outlook sync.',
    })
  }

  try {
    const result = await previewMicrosoftCalendarInitialSync({
      workspaceId: params.workspaceId,
      connectionId: params.connectionId,
    })
    if (!result.ok) {
      return schedulingErrorResponse({
        status: result.retryable ? 503 : 400,
        message: result.safeMessage,
      })
    }
    return schedulingApiSuccess(result.value)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

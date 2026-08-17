import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { resolveMicrosoftCalendarConflict } from '@/lib/scheduling/providers/microsoftService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../../_lib/auth'

type RouteContext = {
  params: { workspaceId: string; conflictId: string }
}

const allowedResolutions = new Set([
  'keepSkillify',
  'keepMicrosoft',
  'merge',
  'ignore',
  'retryLater',
])

export async function POST(request: Request, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return schedulingErrorResponse({
      status: 403,
      message:
        'You do not have permission to resolve Microsoft Outlook conflicts.',
    })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const resolution = String(body.resolution ?? '')
    if (!allowedResolutions.has(resolution)) {
      return schedulingErrorResponse({
        status: 400,
        message: 'Choose a valid conflict resolution.',
      })
    }
    const result = await resolveMicrosoftCalendarConflict({
      workspaceId: params.workspaceId,
      conflictId: params.conflictId,
      actorUserId: actor.actorUserId,
      resolution: resolution as Parameters<
        typeof resolveMicrosoftCalendarConflict
      >[0]['resolution'],
      rememberDecision: body.rememberDecision === true,
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

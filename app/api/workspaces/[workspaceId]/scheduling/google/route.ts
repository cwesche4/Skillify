import { type NextRequest } from 'next/server'

import { listGoogleCalendarIntegrationState } from '@/lib/scheduling/providers/googleService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    return schedulingApiSuccess(
      await listGoogleCalendarIntegrationState({
        workspaceId: params.workspaceId,
        actorWorkspaceMemberId: actor.workspaceMemberId,
        canManageScheduling: actor.canManageScheduling,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

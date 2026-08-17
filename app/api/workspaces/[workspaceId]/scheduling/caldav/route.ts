import { type NextRequest } from 'next/server'

import { listCalDavCalendarIntegrationState } from '@/lib/scheduling/providers/caldavService'
import { normalizeCalDavPlatform } from '@/lib/scheduling/providers/caldav'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const platform = request.nextUrl.searchParams.get('platform')
    return schedulingApiSuccess(
      await listCalDavCalendarIntegrationState({
        workspaceId: params.workspaceId,
        actorWorkspaceMemberId: actor.workspaceMemberId,
        canManageScheduling: actor.canManageScheduling,
        platform: platform ? normalizeCalDavPlatform(platform) : undefined,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

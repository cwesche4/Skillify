import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { countUnreadSchedulingNotifications } from '@/lib/scheduling/notifications/notificationService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../scheduling/_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const count = await countUnreadSchedulingNotifications({
      workspaceId: params.workspaceId,
      userId: actor.actorUserId,
    })
    return schedulingApiSuccess({ count })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

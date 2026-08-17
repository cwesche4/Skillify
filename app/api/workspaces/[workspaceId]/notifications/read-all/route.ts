import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { markAllSchedulingNotificationsRead } from '@/lib/scheduling/notifications/notificationService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../scheduling/_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const result = await markAllSchedulingNotificationsRead({
      workspaceId: params.workspaceId,
      userId: actor.actorUserId,
    })
    return schedulingApiSuccess(result)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

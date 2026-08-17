import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { markSchedulingNotificationRead } from '@/lib/scheduling/notifications/notificationService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../scheduling/_lib/auth'

type RouteContext = {
  params: { workspaceId: string; notificationId: string }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    await markSchedulingNotificationRead({
      workspaceId: params.workspaceId,
      userId: actor.actorUserId,
      notificationId: params.notificationId,
    })
    return schedulingApiSuccess({ ok: true })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

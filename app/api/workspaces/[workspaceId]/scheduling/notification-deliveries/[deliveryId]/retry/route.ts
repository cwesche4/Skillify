import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { retrySchedulingNotificationDelivery } from '@/lib/scheduling/notifications/notificationService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; deliveryId: string } }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return Response.json(
      {
        ok: false,
        code: 'FORBIDDEN',
        message: 'You do not have permission to retry delivery attempts.',
      },
      { status: 403 },
    )
  }

  try {
    await retrySchedulingNotificationDelivery({
      workspaceId: params.workspaceId,
      deliveryId: params.deliveryId,
    })
    return schedulingApiSuccess({ ok: true })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

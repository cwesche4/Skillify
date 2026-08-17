import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { listSchedulingNotificationDeliveries } from '@/lib/scheduling/notifications/notificationService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return Response.json(
      {
        ok: false,
        code: 'FORBIDDEN',
        message: 'You do not have permission to view delivery diagnostics.',
      },
      { status: 403 },
    )
  }

  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50)
    const deliveries = await listSchedulingNotificationDeliveries({
      workspaceId: params.workspaceId,
      limit,
    })
    return schedulingApiSuccess({ deliveries })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

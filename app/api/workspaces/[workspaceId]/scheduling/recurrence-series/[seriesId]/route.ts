import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { changeSchedulingRecurrenceSeriesStatus } from '@/lib/scheduling/services/schedulingService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string; seriesId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    await changeSchedulingRecurrenceSeriesStatus({
      actor,
      seriesId: params.seriesId,
      action: body.action,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
    })
    return schedulingApiSuccess({})
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

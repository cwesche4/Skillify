import { type NextRequest } from 'next/server'

import {
  deleteSchedulingAvailabilityRecord,
  updateSchedulingAvailabilityRecord,
} from '@/lib/scheduling/services/schedulingService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string; recordId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json()
    const record = await updateSchedulingAvailabilityRecord({
      actor,
      recordId: params.recordId,
      record: body.record ?? body,
    })
    return schedulingApiSuccess({ record })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    await deleteSchedulingAvailabilityRecord({
      actor,
      recordId: params.recordId,
    })
    return schedulingApiSuccess({})
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

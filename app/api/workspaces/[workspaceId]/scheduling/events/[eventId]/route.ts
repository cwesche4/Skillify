import { type NextRequest } from 'next/server'

import {
  changeSchedulingEventStatus,
  deleteSchedulingEvent,
  duplicateSchedulingEvent,
  updateSchedulingEvent,
} from '@/lib/scheduling/services/schedulingService'
import {
  schedulingApiError,
  schedulingApiSuccess,
} from '@/lib/scheduling/apiResponses'
import type { SchedulingEventStatus } from '@/lib/scheduling/types'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string; eventId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json()
    if (body.status && !body.event) {
      const event = await changeSchedulingEventStatus({
        actor,
        eventId: params.eventId,
        status: body.status as SchedulingEventStatus,
        scope: body.scope,
        expectedVersion: body.expectedVersion,
        idempotencyKey: body.idempotencyKey,
      })
      return schedulingApiSuccess({ event })
    }
    const event = await updateSchedulingEvent({
      actor,
      eventId: params.eventId,
      input: body.event ?? body,
      scope: body.scope,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
    })
    return schedulingApiSuccess({ event })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    if (body.action !== 'duplicate') {
      return schedulingApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Unsupported event action.',
      })
    }
    const event = await duplicateSchedulingEvent({
      actor,
      eventId: params.eventId,
      scope: body.scope,
    })
    return schedulingApiSuccess({ event }, { status: 201 })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    await deleteSchedulingEvent({
      actor,
      eventId: params.eventId,
      scope: body.scope,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
    })
    return schedulingApiSuccess({})
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

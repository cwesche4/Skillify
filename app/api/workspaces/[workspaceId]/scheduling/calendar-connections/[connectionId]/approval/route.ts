import { type NextRequest } from 'next/server'
import { CalendarConnectionPurpose } from '@prisma/client'

import { prisma } from '@/lib/db'
import { updateCalendarConnectionApproval } from '@/lib/scheduling/providers/calendarGovernance'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; connectionId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: {
        id: params.connectionId,
        workspaceId: params.workspaceId,
        disconnectedAt: null,
      },
      select: { id: true },
    })
    if (!connection) {
      return Response.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
    }
    const body = await request.json().catch(() => ({}))
    const actionValues = new Set([
      'approve',
      'approveReadOnly',
      'approveBusyOnly',
      'approveSuggestion',
      'approveBlocking',
      'approveWork',
      'reclassify',
      'requestChanges',
      'reject',
    ])
    const action =
      typeof body?.action === 'string' && actionValues.has(body.action)
        ? body.action
        : 'approve'
    const purpose =
      typeof body?.purpose === 'string' &&
      body.purpose in CalendarConnectionPurpose
        ? (body.purpose as CalendarConnectionPurpose)
        : undefined
    const updated = await updateCalendarConnectionApproval({
      workspaceId: params.workspaceId,
      connectionId: params.connectionId,
      action: action as Parameters<
        typeof updateCalendarConnectionApproval
      >[0]['action'],
      actorMemberId: actor.workspaceMemberId,
      purpose,
      reason: typeof body?.reason === 'string' ? body.reason : undefined,
    })
    return schedulingApiSuccess({ connection: updated })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

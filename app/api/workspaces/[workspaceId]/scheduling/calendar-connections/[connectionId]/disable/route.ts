import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { setCalendarConnectionDisabled } from '@/lib/scheduling/providers/calendarGovernance'
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
    const disabled = body?.disabled !== false
    const updated = await setCalendarConnectionDisabled({
      workspaceId: params.workspaceId,
      connectionId: params.connectionId,
      disabled,
      reason: disabled ? 'ADMIN_DISABLED' : 'ADMIN_REENABLE_REQUESTED',
      actorMemberId: actor.workspaceMemberId,
    })
    return schedulingApiSuccess({ connection: updated })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

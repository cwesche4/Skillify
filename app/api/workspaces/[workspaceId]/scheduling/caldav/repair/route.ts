import { type NextRequest } from 'next/server'

import { inspectCalDavCalendarMappingIntegrity } from '@/lib/scheduling/providers/caldavService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    return schedulingApiSuccess(
      await inspectCalDavCalendarMappingIntegrity({
        workspaceId: params.workspaceId,
        repair: body?.repair === true,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

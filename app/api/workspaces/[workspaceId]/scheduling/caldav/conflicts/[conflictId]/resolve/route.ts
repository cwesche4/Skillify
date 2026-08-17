import { type NextRequest } from 'next/server'

import { resolveCalDavCalendarConflict } from '@/lib/scheduling/providers/caldavService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../../../_lib/auth'

type RouteContext = { params: { workspaceId: string; conflictId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    return schedulingApiSuccess(
      await resolveCalDavCalendarConflict({
        workspaceId: params.workspaceId,
        conflictId: params.conflictId,
        actorUserId: actor.actorUserId,
        resolution:
          body?.resolution === 'keepCalDav' ||
          body?.resolution === 'keepGoogle' ||
          body?.resolution === 'merge' ||
          body?.resolution === 'ignore' ||
          body?.resolution === 'retryLater'
            ? body.resolution
            : 'keepSkillify',
        rememberDecision: body?.rememberDecision === true,
      }),
    )
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

import { type NextRequest } from 'next/server'

import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingNotificationPreferences,
  resetMemberSchedulingNotificationPreferences,
  saveMemberSchedulingNotificationPreferences,
  saveWorkspaceSchedulingNotificationPreferences,
} from '@/lib/scheduling/notifications/notificationService'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const preferences = await getSchedulingNotificationPreferences({
      workspaceId: params.workspaceId,
      userId: actor.actorUserId,
    })
    return schedulingApiSuccess({
      preferences,
      runtime: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        developmentEmailMode: process.env.SCHEDULING_EMAIL_DEV_MODE ?? null,
      },
    })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json()
    if (body.scope === 'workspace') {
      if (!actor.canManageScheduling) {
        return Response.json(
          {
            ok: false,
            code: 'FORBIDDEN',
            message:
              'You do not have permission to edit workspace notification defaults.',
          },
          { status: 403 },
        )
      }
      await saveWorkspaceSchedulingNotificationPreferences({
        workspaceId: params.workspaceId,
        preferences: body.preferences ?? {},
      })
    } else {
      if (body.action === 'reset') {
        await resetMemberSchedulingNotificationPreferences({
          workspaceId: params.workspaceId,
          userId: actor.actorUserId,
        })
      } else {
        await saveMemberSchedulingNotificationPreferences({
          workspaceId: params.workspaceId,
          userId: actor.actorUserId,
          preferences: body.preferences ?? {},
        })
      }
    }
    const preferences = await getSchedulingNotificationPreferences({
      workspaceId: params.workspaceId,
      userId: actor.actorUserId,
    })
    return schedulingApiSuccess({
      preferences,
      runtime: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        developmentEmailMode: process.env.SCHEDULING_EMAIL_DEV_MODE ?? null,
      },
    })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

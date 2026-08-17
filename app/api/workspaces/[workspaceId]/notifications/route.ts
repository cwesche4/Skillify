import { type NextRequest } from 'next/server'

import {
  bulkArchiveSchedulingNotifications,
  listSchedulingNotifications,
  markAllSchedulingNotificationsRead,
} from '@/lib/scheduling/notifications/notificationService'
import { schedulingNotificationCategories } from '@/lib/scheduling/notifications/notificationPolicy'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../scheduling/_lib/auth'

type RouteContext = { params: { workspaceId: string } }
type NotificationCategory = (typeof schedulingNotificationCategories)[number]

function isNotificationCategory(
  value: string | null,
): value is NotificationCategory {
  return (
    value !== null &&
    schedulingNotificationCategories.includes(value as NotificationCategory)
  )
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const searchParams = request.nextUrl.searchParams
    const statusParam = searchParams.get('status')
    const categoryParam = searchParams.get('category')
    const status =
      statusParam === 'unread' ||
      statusParam === 'read' ||
      statusParam === 'archived'
        ? statusParam
        : searchParams.get('unread') === 'true'
          ? 'unread'
          : 'active'
    const category = isNotificationCategory(categoryParam)
      ? categoryParam
      : null
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = Number(searchParams.get('limit') ?? 20)
    const result = await listSchedulingNotifications({
      workspaceId: params.workspaceId,
      userId: actor.actorUserId,
      status,
      category,
      cursor,
      limit,
    })
    return schedulingApiSuccess(result)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json().catch(() => ({}))
    if (body.action === 'readAll') {
      const result = await markAllSchedulingNotificationsRead({
        workspaceId: params.workspaceId,
        userId: actor.actorUserId,
      })
      return schedulingApiSuccess(result)
    }
    if (body.action === 'archiveAll') {
      const result = await bulkArchiveSchedulingNotifications({
        workspaceId: params.workspaceId,
        userId: actor.actorUserId,
      })
      return schedulingApiSuccess(result)
    }
    return schedulingApiSuccess({ ok: true })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

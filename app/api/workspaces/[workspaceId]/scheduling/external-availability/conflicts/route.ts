import { type NextRequest } from 'next/server'

import { checkExternalAvailabilityConflicts } from '@/lib/scheduling/externalAvailability'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

function idsFromSearch(value: string | null) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const searchParams = request.nextUrl.searchParams
    const requestedMemberIds = idsFromSearch(
      searchParams.get('workspaceMemberIds'),
    )
    const memberIds = actor.canManageScheduling
      ? requestedMemberIds
      : requestedMemberIds.filter((id) => id === actor.workspaceMemberId)
    const startsAtUtc = searchParams.get('startsAtUtc')
    const endsAtUtc = searchParams.get('endsAtUtc')
    if (!startsAtUtc || !endsAtUtc) {
      return Response.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Start and end times are required.',
        },
        { status: 400 },
      )
    }
    const results = await checkExternalAvailabilityConflicts({
      workspaceId: params.workspaceId,
      workspaceMemberIds: memberIds,
      startsAtUtc,
      endsAtUtc,
      schedulingEventId: searchParams.get('schedulingEventId'),
    })
    return schedulingApiSuccess({ results })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

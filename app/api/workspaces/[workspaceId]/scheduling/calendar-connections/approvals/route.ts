import { type NextRequest } from 'next/server'

import { listCalendarConnectionApprovalRequests } from '@/lib/scheduling/providers/calendarGovernance'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor
  if (!actor.canManageScheduling) {
    return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const requests = await listCalendarConnectionApprovalRequests({
      workspaceId: params.workspaceId,
      status: searchParams.get('status'),
      provider: searchParams.get('provider'),
      purpose: searchParams.get('purpose'),
      memberId: searchParams.get('memberId'),
      actionRequiredOnly: searchParams.get('actionRequiredOnly') !== 'false',
    })
    return schedulingApiSuccess({ requests })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

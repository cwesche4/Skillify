import { NextResponse } from 'next/server'

import {
  authorizeRecurringServiceRequest,
  readRecurringServiceJson,
  recurringServiceApiError,
  recurringServiceAuthorizationError,
} from '@/lib/recurring-services/api'
import { recurringServiceService } from '@/lib/recurring-services/defaultService'

type RouteContext = {
  params: { workspaceId: string; recurringServiceId: string }
}

function actorFromAuthorization(authorization: {
  workspaceId: string
  userProfileId: string
  workspaceMemberId: string | null
}) {
  if (!authorization.workspaceMemberId) {
    throw new Error('Authorized workspace membership is missing an identity.')
  }
  return {
    workspaceId: authorization.workspaceId,
    userProfileId: authorization.userProfileId,
    workspaceMemberId: authorization.workspaceMemberId,
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeRecurringServiceRequest(
    params.workspaceId,
    'manage',
  )
  if (!authorization.allowed) {
    return recurringServiceAuthorizationError(authorization)
  }
  try {
    const recurringService = await recurringServiceService.getRecurringService(
      params.workspaceId,
      params.recurringServiceId,
    )
    if (!recurringService) {
      return NextResponse.json(
        {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Recurring Service not found.',
        },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, recurringService })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeRecurringServiceRequest(
    params.workspaceId,
  )
  if (!authorization.allowed) {
    return recurringServiceAuthorizationError(authorization)
  }
  try {
    const input = await readRecurringServiceJson(request)
    const recurringService =
      await recurringServiceService.updateRecurringService(
        actorFromAuthorization(authorization),
        params.recurringServiceId,
        input,
      )
    return NextResponse.json({ ok: true, recurringService })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

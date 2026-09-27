import { NextResponse } from 'next/server'

import {
  authorizeRecurringServiceRequest,
  readRecurringServiceJson,
  recurringServiceApiError,
  recurringServiceAuthorizationError,
} from '@/lib/recurring-services/api'
import { recurringServiceService } from '@/lib/recurring-services/defaultService'

type RouteContext = { params: { workspaceId: string } }

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
    'view',
  )
  if (!authorization.allowed) {
    return recurringServiceAuthorizationError(authorization)
  }
  try {
    const recurringServices =
      await recurringServiceService.listRecurringServices(params.workspaceId)
    return NextResponse.json({ ok: true, recurringServices })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeRecurringServiceRequest(
    params.workspaceId,
  )
  if (!authorization.allowed) {
    return recurringServiceAuthorizationError(authorization)
  }
  try {
    const input = await readRecurringServiceJson(request)
    const recurringService =
      await recurringServiceService.createRecurringService(
        actorFromAuthorization(authorization),
        input,
      )
    return NextResponse.json({ ok: true, recurringService }, { status: 201 })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

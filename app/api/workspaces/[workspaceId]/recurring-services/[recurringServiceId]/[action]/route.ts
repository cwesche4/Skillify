import { NextResponse } from 'next/server'

import {
  authorizeRecurringServiceRequest,
  readRecurringServiceJson,
  recurringServiceApiError,
  recurringServiceAuthorizationError,
} from '@/lib/recurring-services/api'
import { recurringServiceService } from '@/lib/recurring-services/defaultService'
import {
  recurringServiceLifecycleActionSchema,
  recurringServiceLifecycleRequestSchema,
} from '@/lib/recurring-services/validation'
import { RecurringServiceServiceError } from '@/lib/recurring-services/service'

type RouteContext = {
  params: {
    workspaceId: string
    recurringServiceId: string
    action: string
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
    if (!authorization.workspaceMemberId) {
      throw new Error('Authorized workspace membership is missing an identity.')
    }
    const action = recurringServiceLifecycleActionSchema.safeParse(
      params.action,
    )
    const body = recurringServiceLifecycleRequestSchema.safeParse(
      await readRecurringServiceJson(request),
    )
    if (!action.success || !body.success) {
      throw new RecurringServiceServiceError(
        'Choose a supported Recurring Service lifecycle action.',
        400,
        'VALIDATION_ERROR',
        body.success ? undefined : body.error.flatten().fieldErrors,
      )
    }
    const recurringService = await recurringServiceService.changeLifecycle({
      actor: {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
        workspaceMemberId: authorization.workspaceMemberId,
      },
      recurringServiceId: params.recurringServiceId,
      action: action.data,
      ...body.data,
    })
    return NextResponse.json({ ok: true, recurringService })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

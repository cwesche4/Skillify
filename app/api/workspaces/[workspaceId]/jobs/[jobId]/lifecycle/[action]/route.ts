import { NextResponse } from 'next/server'

import {
  authorizeOperationsRequest,
  operationsApiError,
  operationsAuthorizationError,
  readOperationsJson,
} from '@/lib/jobs/api'
import { recurringJobLifecycleService } from '@/lib/recurring-services/jobLifecycle'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'
import { operationsService } from '@/lib/jobs/defaultService'

type RouteContext = {
  params: {
    workspaceId: string
    jobId: string
    action: string
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'view',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }
  if (!authorization.workspaceMemberId) {
    return NextResponse.json(
      { ok: false, code: 'FORBIDDEN', message: 'Forbidden' },
      { status: 403 },
    )
  }

  try {
    const input = await readOperationsJson(request)
    const actor = {
      workspaceId: params.workspaceId,
      userProfileId: authorization.userProfileId,
      workspaceMemberId: authorization.workspaceMemberId,
      canManage: canManageOperations(authorization.role),
    }
    const isExecutionAction =
      params.action === 'start' ||
      params.action === 'complete' ||
      params.action === 'update'
    const executionInput =
      input && typeof input === 'object' && !Array.isArray(input)
        ? {
            ...input,
            ...(params.action === 'start'
              ? { status: 'IN_PROGRESS' }
              : params.action === 'complete'
                ? { status: 'COMPLETED' }
                : {}),
          }
        : input
    const job = isExecutionAction
      ? await operationsService.executeAssignedJob(
          actor,
          params.jobId,
          executionInput,
        )
      : params.action === 'unable-to-complete'
        ? await recurringJobLifecycleService.reportUnableToComplete(
            actor,
            params.jobId,
            input,
          )
        : params.action === 'skip'
          ? await recurringJobLifecycleService.skipVisit(
              actor,
              params.jobId,
              input,
            )
          : params.action === 'reschedule'
            ? await recurringJobLifecycleService.rescheduleUnable(
                actor,
                params.jobId,
                input,
              )
            : null
    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Choose a supported Job lifecycle action.',
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true, job })
  } catch (error) {
    return operationsApiError(error)
  }
}

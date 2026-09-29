import { NextResponse } from 'next/server'

import {
  authorizeOperationsRequest,
  operationsApiError,
  operationsAuthorizationError,
  readOperationsJson,
} from '@/lib/jobs/api'
import { operationsService } from '@/lib/jobs/defaultService'
import { canWorkspaceMemberExecuteJob } from '@/lib/jobs/jobExecutionAuthorization'
import { presentJobOperationalContext } from '@/lib/jobs/operationalContext'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

type RouteContext = {
  params: { workspaceId: string; jobId: string }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'view',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }

  try {
    const job = await operationsService.getJob(params.workspaceId, params.jobId)
    if (!job) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Job not found.' },
        { status: 404 },
      )
    }
    const canManage = canManageOperations(authorization.role)
    const canExecute =
      canManage ||
      Boolean(
        authorization.workspaceMemberId &&
        (await canWorkspaceMemberExecuteJob({
          workspaceId: params.workspaceId,
          jobId: params.jobId,
          workspaceMemberId: authorization.workspaceMemberId,
        })),
      )
    return NextResponse.json({
      ok: true,
      job: {
        ...presentJobOperationalContext(
          job,
          canExecute,
          canManage ||
            job.unableToCompleteReportedByMemberId ===
              authorization.workspaceMemberId,
        ),
        canCurrentMemberExecute: canExecute,
      },
    })
  } catch (error) {
    return operationsApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'manage',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }

  try {
    const input = await readOperationsJson(request)
    const job = await operationsService.updateJob(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.jobId,
      input,
    )
    return NextResponse.json({ ok: true, job })
  } catch (error) {
    return operationsApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'manage',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }

  try {
    const job = await operationsService.archiveJob(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.jobId,
    )
    return NextResponse.json({ ok: true, job })
  } catch (error) {
    return operationsApiError(error)
  }
}

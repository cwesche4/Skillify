import { NextResponse } from 'next/server'

import {
  authorizeOperationsRequest,
  operationsApiError,
  operationsAuthorizationError,
  readOperationsJson,
} from '@/lib/jobs/api'
import { operationsService } from '@/lib/jobs/defaultService'
import { listWorkspaceMemberExecutableJobIds } from '@/lib/jobs/jobExecutionAuthorization'
import { presentJobOperationalContext } from '@/lib/jobs/operationalContext'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'view',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }

  try {
    const customerId =
      new URL(request.url).searchParams.get('customerId') ?? undefined
    const jobs = await operationsService.listJobs(params.workspaceId, {
      customerId,
    })
    const canManage = canManageOperations(authorization.role)
    const executableJobIds =
      canManage || !authorization.workspaceMemberId
        ? new Set<string>()
        : await listWorkspaceMemberExecutableJobIds({
            workspaceId: params.workspaceId,
            jobIds: jobs.map((job) => job.id),
            workspaceMemberId: authorization.workspaceMemberId,
          })
    const presentedJobs = jobs.map((job) => {
      const canExecute = canManage || executableJobIds.has(job.id)
      return {
        ...presentJobOperationalContext(job, canExecute),
        canCurrentMemberExecute: canExecute,
      }
    })
    return NextResponse.json({ ok: true, jobs: presentedJobs })
  } catch (error) {
    return operationsApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'manage',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }

  try {
    const input = await readOperationsJson(request)
    const job = await operationsService.createJob(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      input,
    )
    return NextResponse.json({ ok: true, job }, { status: 201 })
  } catch (error) {
    return operationsApiError(error)
  }
}

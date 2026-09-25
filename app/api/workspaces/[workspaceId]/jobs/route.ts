import { NextResponse } from 'next/server'

import {
  authorizeOperationsRequest,
  operationsApiError,
  operationsAuthorizationError,
  readOperationsJson,
} from '@/lib/jobs/api'
import { operationsService } from '@/lib/jobs/defaultService'

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
    return NextResponse.json({ ok: true, jobs })
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

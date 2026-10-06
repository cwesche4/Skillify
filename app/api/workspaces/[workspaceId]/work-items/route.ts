import { NextResponse } from 'next/server'

import {
  authorizeOperationsRequest,
  operationsApiError,
  operationsAuthorizationError,
  readOperationsJson,
} from '@/lib/jobs/api'
import { operationsService } from '@/lib/jobs/defaultService'
import { WorkItemKind } from '@/lib/prisma/enums'
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
    const canManage = canManageOperations(authorization.role)
    if (!canManage && !authorization.workspaceMemberId) {
      return NextResponse.json(
        { ok: false, code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      )
    }
    const kind = new URL(request.url).searchParams.get('kind')
    if (kind && kind !== WorkItemKind.JOB_STEP && kind !== WorkItemKind.TODO) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Work Item kind is invalid.',
        },
        { status: 400 },
      )
    }
    const workItems = await operationsService.listWorkItems({
      workspaceId: params.workspaceId,
      kind:
        kind === WorkItemKind.JOB_STEP || kind === WorkItemKind.TODO
          ? kind
          : undefined,
      visibleToMemberId: canManage
        ? undefined
        : (authorization.workspaceMemberId ?? undefined),
    })
    return NextResponse.json({ ok: true, workItems })
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
    const workItem = await operationsService.createTodo(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      input,
    )
    return NextResponse.json({ ok: true, workItem }, { status: 201 })
  } catch (error) {
    return operationsApiError(error)
  }
}

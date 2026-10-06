import { NextResponse } from 'next/server'

import {
  authorizeOperationsRequest,
  operationsApiError,
  operationsAuthorizationError,
  readOperationsJson,
} from '@/lib/jobs/api'
import { operationsService } from '@/lib/jobs/defaultService'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

type RouteContext = {
  params: { workspaceId: string; workItemId: string }
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
    const canManage = canManageOperations(authorization.role)
    if (!canManage && !authorization.workspaceMemberId) {
      return NextResponse.json(
        { ok: false, code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      )
    }
    const workItem = await operationsService.getWorkItem(
      params.workspaceId,
      params.workItemId,
      canManage ? undefined : (authorization.workspaceMemberId ?? undefined),
    )
    if (!workItem) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Work Item not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, workItem })
  } catch (error) {
    return operationsApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeOperationsRequest(
    params.workspaceId,
    'view',
  )
  if (!authorization.allowed) {
    return operationsAuthorizationError(authorization)
  }

  try {
    const input = await readOperationsJson(request)
    const workItem = canManageOperations(authorization.role)
      ? await operationsService.updateWorkItem(
          {
            workspaceId: params.workspaceId,
            userProfileId: authorization.userProfileId,
          },
          params.workItemId,
          input,
        )
      : authorization.role === 'MEMBER' && authorization.workspaceMemberId
        ? await operationsService.executeAssignedWorkItem(
            {
              workspaceId: params.workspaceId,
              userProfileId: authorization.userProfileId,
              workspaceMemberId: authorization.workspaceMemberId,
            },
            params.workItemId,
            input,
          )
        : null
    if (!workItem) {
      return NextResponse.json(
        { ok: false, code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      )
    }
    return NextResponse.json({ ok: true, workItem })
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
    const workItem = await operationsService.archiveWorkItem(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.workItemId,
    )
    return NextResponse.json({ ok: true, workItem })
  } catch (error) {
    return operationsApiError(error)
  }
}

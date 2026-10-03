import { NextResponse } from 'next/server'

import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import { operationalizeAcceptedEstimate } from '@/lib/estimates/operationalization'

type RouteContext = {
  params: { workspaceId: string; estimateId: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const result = await operationalizeAcceptedEstimate({
      actor: {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
        actorUserId: authorization.userProfileId,
        workspaceMemberId: authorization.workspaceMemberId ?? '',
        canManageScheduling: true,
      },
      estimateId: params.estimateId,
      rawInput: await readEstimateJson(request),
    })
    return NextResponse.json(
      { ok: true, ...result },
      { status: result.replayed ? 200 : 201 },
    )
  } catch (error) {
    return estimateApiError(error)
  }
}

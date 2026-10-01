import { NextResponse } from 'next/server'

import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import { estimateService } from '@/lib/estimates/defaultService'

type RouteContext = {
  params: { workspaceId: string; estimateId: string }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const result = await estimateService.getEstimate(
      params.workspaceId,
      params.estimateId,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return estimateApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const estimate = await estimateService.updateEstimate(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.estimateId,
      await readEstimateJson(request),
    )
    return NextResponse.json({ ok: true, estimate })
  } catch (error) {
    return estimateApiError(error)
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const estimate = await estimateService.archiveEstimate(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.estimateId,
      await readEstimateJson(request),
    )
    return NextResponse.json({ ok: true, estimate })
  } catch (error) {
    return estimateApiError(error)
  }
}

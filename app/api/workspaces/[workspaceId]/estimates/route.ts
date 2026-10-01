import { NextResponse } from 'next/server'

import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import { estimateService } from '@/lib/estimates/defaultService'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const searchParams = new URL(request.url).searchParams
    const result = await estimateService.listEstimates(params.workspaceId, {
      view: searchParams.get('view') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      leadId: searchParams.get('leadId') ?? undefined,
      customerId: searchParams.get('customerId') ?? undefined,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return estimateApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const estimate = await estimateService.createEstimate(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      await readEstimateJson(request),
    )
    return NextResponse.json({ ok: true, estimate }, { status: 201 })
  } catch (error) {
    return estimateApiError(error)
  }
}

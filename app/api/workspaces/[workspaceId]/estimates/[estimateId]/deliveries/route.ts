import { NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit/log'
import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import {
  listEstimateDeliveries,
  queueEstimateDelivery,
} from '@/lib/estimates/customerExperience'
import { resolveVerifiedEstimateSender } from '@/lib/estimates/estimateEmail'

type RouteContext = {
  params: { workspaceId: string; estimateId: string }
}

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const search = new URL(request.url).searchParams
    const result = await listEstimateDeliveries({
      workspaceId: params.workspaceId,
      estimateId: params.estimateId,
      rawQuery: {
        cursor: search.get('cursor') ?? undefined,
        pageSize: search.get('pageSize') ?? undefined,
      },
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
    const body = await readEstimateJson(request)
    await resolveVerifiedEstimateSender(params.workspaceId)
    const result = await queueEstimateDelivery({
      workspaceId: params.workspaceId,
      estimateId: params.estimateId,
      actorUserId: authorization.userProfileId,
      rawInput: body,
    })
    await logAudit({
      workspaceId: params.workspaceId,
      actorId: authorization.userProfileId,
      action: result.replayed
        ? 'ESTIMATE_DELIVERY_REPLAYED'
        : 'ESTIMATE_DELIVERY_QUEUED',
      targetType: 'EstimateDelivery',
      targetId: result.delivery.id,
      meta: { estimateId: params.estimateId, channel: 'EMAIL' },
    })
    return NextResponse.json(
      { ok: true, delivery: result.delivery, replayed: result.replayed },
      { status: result.replayed ? 200 : 201 },
    )
  } catch (error) {
    return estimateApiError(error)
  }
}

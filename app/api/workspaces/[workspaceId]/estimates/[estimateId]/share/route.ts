import { NextResponse } from 'next/server'

import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import {
  getOrCreateEstimateShare,
  publicEstimateBaseUrl,
  revokeEstimateShare,
  signedEstimateShareUrl,
} from '@/lib/estimates/customerExperience'
import { logAudit } from '@/lib/audit/log'

type RouteContext = {
  params: { workspaceId: string; estimateId: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const share = await getOrCreateEstimateShare({
      workspaceId: params.workspaceId,
      estimateId: params.estimateId,
      actorUserId: authorization.userProfileId,
      rawInput: await readEstimateJson(request),
    })
    await logAudit({
      workspaceId: params.workspaceId,
      actorId: authorization.userProfileId,
      action: 'ESTIMATE_SHARE_COPIED',
      targetType: 'EstimateShare',
      targetId: share.id,
      meta: { estimateId: params.estimateId },
    })
    return NextResponse.json({
      ok: true,
      share: {
        id: share.id,
        expiresAt: share.expiresAt,
        url: signedEstimateShareUrl(
          share.publicId,
          publicEstimateBaseUrl(request.url),
        ),
      },
    })
  } catch (error) {
    return estimateApiError(error)
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const share = await revokeEstimateShare({
      workspaceId: params.workspaceId,
      estimateId: params.estimateId,
      rawInput: await readEstimateJson(request),
    })
    if (share) {
      await logAudit({
        workspaceId: params.workspaceId,
        actorId: authorization.userProfileId,
        action: 'ESTIMATE_SHARE_REVOKED',
        targetType: 'EstimateShare',
        targetId: share.id,
        meta: { estimateId: params.estimateId },
      })
    }
    return NextResponse.json({ ok: true, revoked: Boolean(share) })
  } catch (error) {
    return estimateApiError(error)
  }
}

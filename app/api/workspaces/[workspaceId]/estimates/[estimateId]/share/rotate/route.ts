import { NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit/log'
import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import {
  publicEstimateBaseUrl,
  rotateEstimateShare,
  signedEstimateShareUrl,
} from '@/lib/estimates/customerExperience'

type RouteContext = {
  params: { workspaceId: string; estimateId: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const share = await rotateEstimateShare({
      workspaceId: params.workspaceId,
      estimateId: params.estimateId,
      actorUserId: authorization.userProfileId,
      rawInput: await readEstimateJson(request),
    })
    await logAudit({
      workspaceId: params.workspaceId,
      actorId: authorization.userProfileId,
      action: 'ESTIMATE_SHARE_ROTATED',
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

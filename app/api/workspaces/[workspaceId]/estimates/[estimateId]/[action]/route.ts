import { NextResponse } from 'next/server'

import {
  authorizeEstimateRequest,
  estimateApiError,
  estimateAuthorizationError,
  readEstimateJson,
} from '@/lib/estimates/api'
import { estimateService } from '@/lib/estimates/defaultService'
import { EstimateServiceError } from '@/lib/estimates/service'

type RouteContext = {
  params: { workspaceId: string; estimateId: string; action: string }
}

const lifecycleActions = new Set(['present', 'accept', 'decline', 'void'])

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeEstimateRequest(params.workspaceId)
  if (!authorization.allowed) return estimateAuthorizationError(authorization)
  try {
    const actor = {
      workspaceId: params.workspaceId,
      userProfileId: authorization.userProfileId,
    }
    const body = await readEstimateJson(request)
    const estimate =
      params.action === 'revise'
        ? await estimateService.createRevision(actor, params.estimateId, body)
        : lifecycleActions.has(params.action)
          ? await estimateService.transitionEstimate(
              actor,
              params.estimateId,
              params.action as 'present' | 'accept' | 'decline' | 'void',
              body,
            )
          : (() => {
              throw new EstimateServiceError(
                'Estimate action not found.',
                404,
                'NOT_FOUND',
              )
            })()
    return NextResponse.json({ ok: true, estimate })
  } catch (error) {
    return estimateApiError(error)
  }
}

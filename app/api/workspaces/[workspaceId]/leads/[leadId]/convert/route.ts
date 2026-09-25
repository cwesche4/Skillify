import { NextResponse } from 'next/server'

import {
  authorizeLeadRequest,
  leadApiError,
  leadAuthorizationError,
  readLeadJson,
} from '@/lib/leads/api'
import { leadService } from '@/lib/leads/defaultService'

type RouteContext = { params: { workspaceId: string; leadId: string } }

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeLeadRequest(params.workspaceId)
  if (!authorization.allowed) return leadAuthorizationError(authorization)

  try {
    const result = await leadService.convertLeadToCustomer(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.leadId,
      await readLeadJson(request),
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return leadApiError(error)
  }
}

import { NextResponse } from 'next/server'

import {
  authorizeLeadRequest,
  leadApiError,
  leadAuthorizationError,
  readLeadJson,
} from '@/lib/leads/api'
import { leadService } from '@/lib/leads/defaultService'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await authorizeLeadRequest(params.workspaceId)
  if (!authorization.allowed) return leadAuthorizationError(authorization)

  try {
    const query = new URL(request.url).searchParams
    const leads = await leadService.listLeads(params.workspaceId, {
      search: query.get('search') ?? undefined,
      stage: query.get('stage') ?? undefined,
    })
    return NextResponse.json({ ok: true, leads })
  } catch (error) {
    return leadApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeLeadRequest(params.workspaceId)
  if (!authorization.allowed) return leadAuthorizationError(authorization)

  try {
    const lead = await leadService.createLead(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      await readLeadJson(request),
    )
    return NextResponse.json({ ok: true, lead }, { status: 201 })
  } catch (error) {
    return leadApiError(error)
  }
}

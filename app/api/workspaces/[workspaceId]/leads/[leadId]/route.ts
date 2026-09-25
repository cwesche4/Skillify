import { NextResponse } from 'next/server'

import {
  authorizeLeadRequest,
  leadApiError,
  leadAuthorizationError,
  readLeadJson,
} from '@/lib/leads/api'
import { leadService } from '@/lib/leads/defaultService'

type RouteContext = { params: { workspaceId: string; leadId: string } }

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeLeadRequest(params.workspaceId)
  if (!authorization.allowed) return leadAuthorizationError(authorization)
  try {
    const lead = await leadService.getLead(params.workspaceId, params.leadId)
    if (!lead) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Lead not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, lead })
  } catch (error) {
    return leadApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeLeadRequest(params.workspaceId)
  if (!authorization.allowed) return leadAuthorizationError(authorization)
  try {
    const lead = await leadService.updateLead(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.leadId,
      await readLeadJson(request),
    )
    return NextResponse.json({ ok: true, lead })
  } catch (error) {
    return leadApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeLeadRequest(params.workspaceId)
  if (!authorization.allowed) return leadAuthorizationError(authorization)
  try {
    const lead = await leadService.archiveLead(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.leadId,
    )
    return NextResponse.json({ ok: true, lead })
  } catch (error) {
    return leadApiError(error)
  }
}

import { type NextRequest } from 'next/server'
import {
  CalendarConnectionOwnershipType,
  CalendarConnectionPurpose,
} from '@prisma/client'

import { beginGoogleCalendarOAuth } from '@/lib/scheduling/providers/googleService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getIntegrationProviderDefinition,
  resolveIntegrationProviderAvailability,
} from '@/lib/integrations/providerRegistry'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

function unavailableResponse(
  availability: ReturnType<
    typeof resolveIntegrationProviderAvailability
  > | null,
) {
  return Response.json(
    {
      ok: false,
      code: availability?.status ?? 'configurationRequired',
      message:
        availability?.safeMessage ??
        'Google Calendar requires Skillify deployment configuration.',
      missing: availability?.missingPlatformEnv ?? [],
    },
    { status: 503 },
  )
}

function getGoogleCalendarAvailability(workspaceId: string) {
  const provider = getIntegrationProviderDefinition('googleCalendar')
  return provider
    ? resolveIntegrationProviderAvailability({ provider, workspaceId })
    : null
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const availability = getGoogleCalendarAvailability(params.workspaceId)
    if (!availability?.canStartConnection) {
      return unavailableResponse(availability)
    }
    const url = new URL(request.url)
    const ownershipType =
      url.searchParams.get('ownershipType') === 'MEMBER'
        ? CalendarConnectionOwnershipType.MEMBER
        : CalendarConnectionOwnershipType.WORKSPACE
    const requestedPurpose =
      ownershipType === CalendarConnectionOwnershipType.WORKSPACE
        ? CalendarConnectionPurpose.WORKSPACE_SHARED
        : CalendarConnectionPurpose.PERSONAL
    if (
      ownershipType === CalendarConnectionOwnershipType.WORKSPACE &&
      !actor.canManageScheduling
    ) {
      return Response.json(
        {
          ok: false,
          code: 'FORBIDDEN',
          message:
            'Only workspace admins can connect workspace Google accounts.',
        },
        { status: 403 },
      )
    }
    const result = await beginGoogleCalendarOAuth({
      workspaceId: params.workspaceId,
      actorUserId: actor.actorUserId,
      actorWorkspaceMemberId: actor.workspaceMemberId,
      ownershipType,
      requestedPurpose,
      returnToSetup: url.searchParams.get('returnToSetup') === 'true',
      setupStep: url.searchParams.get('setupStep') ?? undefined,
    })
    if (!result.ok) return schedulingApiSuccess(result)
    return Response.redirect(result.value.authorizationUrl)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const availability = getGoogleCalendarAvailability(params.workspaceId)
    if (!availability?.canStartConnection) {
      return unavailableResponse(availability)
    }
    const body = await request.json().catch(() => ({}))
    const ownershipType =
      body?.ownershipType === 'WORKSPACE'
        ? CalendarConnectionOwnershipType.WORKSPACE
        : CalendarConnectionOwnershipType.MEMBER
    const requestedPurpose =
      typeof body?.connectionPurpose === 'string' &&
      body.connectionPurpose in CalendarConnectionPurpose
        ? (body.connectionPurpose as CalendarConnectionPurpose)
        : undefined
    if (
      ownershipType === CalendarConnectionOwnershipType.WORKSPACE &&
      !actor.canManageScheduling
    ) {
      return Response.json(
        {
          ok: false,
          code: 'FORBIDDEN',
          message:
            'Only workspace admins can connect workspace Google accounts.',
        },
        { status: 403 },
      )
    }
    const result = await beginGoogleCalendarOAuth({
      workspaceId: params.workspaceId,
      actorUserId: actor.actorUserId,
      actorWorkspaceMemberId: actor.workspaceMemberId,
      ownershipType,
      requestedPurpose,
      returnToSetup: body?.returnToSetup === true,
      setupStep:
        typeof body?.setupStep === 'string' ? body.setupStep : undefined,
    })
    return schedulingApiSuccess(result)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

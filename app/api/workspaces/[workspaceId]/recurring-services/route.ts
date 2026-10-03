import { NextResponse } from 'next/server'

import {
  authorizeRecurringServiceRequest,
  readRecurringServiceJson,
  recurringServiceApiError,
  recurringServiceAuthorizationError,
} from '@/lib/recurring-services/api'
import { recurringServiceService } from '@/lib/recurring-services/defaultService'
import { prisma } from '@/lib/db'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

type RouteContext = { params: { workspaceId: string } }

function actorFromAuthorization(authorization: {
  workspaceId: string
  userProfileId: string
  workspaceMemberId: string | null
}) {
  if (!authorization.workspaceMemberId) {
    throw new Error('Authorized workspace membership is missing an identity.')
  }
  return {
    workspaceId: authorization.workspaceId,
    userProfileId: authorization.userProfileId,
    workspaceMemberId: authorization.workspaceMemberId,
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeRecurringServiceRequest(
    params.workspaceId,
    'view',
  )
  if (!authorization.allowed) {
    return recurringServiceAuthorizationError(authorization)
  }
  try {
    const recurringServices =
      await recurringServiceService.listRecurringServices(params.workspaceId)
    const canManage = canManageOperations(authorization.role)
    const sources = canManage
      ? await prisma.estimateOperationalizationItem.findMany({
          where: {
            workspaceId: params.workspaceId,
            recurringServiceId: {
              in: recurringServices.map((service) => service.id),
            },
          },
          select: {
            recurringServiceId: true,
            estimate: {
              select: { id: true, referenceNumber: true, title: true },
            },
          },
        })
      : []
    const sourceByServiceId = new Map(
      sources.flatMap((source) =>
        source.recurringServiceId
          ? [[source.recurringServiceId, source.estimate] as const]
          : [],
      ),
    )
    return NextResponse.json({
      ok: true,
      recurringServices: recurringServices.map((service) => ({
        ...service,
        sourceEstimate: canManage
          ? (sourceByServiceId.get(service.id) ?? null)
          : null,
      })),
    })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeRecurringServiceRequest(
    params.workspaceId,
  )
  if (!authorization.allowed) {
    return recurringServiceAuthorizationError(authorization)
  }
  try {
    const input = await readRecurringServiceJson(request)
    const recurringService =
      await recurringServiceService.createRecurringService(
        actorFromAuthorization(authorization),
        input,
      )
    return NextResponse.json({ ok: true, recurringService }, { status: 201 })
  } catch (error) {
    return recurringServiceApiError(error)
  }
}

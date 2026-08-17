import { type NextRequest } from 'next/server'

import {
  createSchedulingAvailabilityRecord,
  listSchedulingWorkspaceData,
  SchedulingServiceError,
} from '@/lib/scheduling/services/schedulingService'
import { prisma } from '@/lib/db'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: params.workspaceId },
    })
    if (!workspace)
      throw new SchedulingServiceError('Workspace not found.', 404)
    const searchParams = request.nextUrl.searchParams
    const data = await listSchedulingWorkspaceData({
      workspaceId: params.workspaceId,
      businessModel: (workspace as any).businessModel,
      capabilities: getWorkspaceCapabilities(workspace as any).scheduling,
      startsBefore: searchParams.get('startsBefore')
        ? new Date(searchParams.get('startsBefore') as string)
        : undefined,
      endsAfter: searchParams.get('endsAfter')
        ? new Date(searchParams.get('endsAfter') as string)
        : undefined,
    })
    return schedulingApiSuccess({ availability: data.availability })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json()
    const record = await createSchedulingAvailabilityRecord({
      actor,
      record: body.record,
    })
    return schedulingApiSuccess({ record }, { status: 201 })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import {
  createSchedulingEvent,
  listSchedulingWorkspaceData,
  SchedulingServiceError,
} from '@/lib/scheduling/services/schedulingService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

async function getWorkspaceContext(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  })
  if (!workspace) {
    throw new SchedulingServiceError('Workspace not found.', 404)
  }
  return {
    workspace,
    capabilities: getWorkspaceCapabilities(workspace as any).scheduling,
  }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const { workspace, capabilities } = await getWorkspaceContext(
      params.workspaceId,
    )
    const searchParams = request.nextUrl.searchParams
    const startsBefore = searchParams.get('startsBefore')
    const endsAfter = searchParams.get('endsAfter')
    const data = await listSchedulingWorkspaceData({
      workspaceId: params.workspaceId,
      businessModel: (workspace as any).businessModel,
      capabilities,
      startsBefore: startsBefore ? new Date(startsBefore) : undefined,
      endsAfter: endsAfter ? new Date(endsAfter) : undefined,
    })
    return schedulingApiSuccess(data)
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const body = await request.json()
    const event = await createSchedulingEvent({
      actor,
      input: body.event,
    })
    return schedulingApiSuccess({ event }, { status: 201 })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

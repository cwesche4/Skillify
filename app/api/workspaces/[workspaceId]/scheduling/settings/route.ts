import { type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import {
  getPersistedSchedulingSettings,
  saveSchedulingSettings,
  SchedulingServiceError,
} from '@/lib/scheduling/services/schedulingService'
import { schedulingApiSuccess } from '@/lib/scheduling/apiResponses'
import {
  getSchedulingActor,
  isResponse,
  schedulingErrorResponse,
} from '../_lib/auth'

type RouteContext = { params: { workspaceId: string } }

async function getWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  })
  if (!workspace) throw new SchedulingServiceError('Workspace not found.', 404)
  return workspace
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const workspace = await getWorkspace(params.workspaceId)
    const settings = await getPersistedSchedulingSettings({
      workspaceId: params.workspaceId,
      businessModel: (workspace as any).businessModel,
    })
    return schedulingApiSuccess({ settings })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const actor = await getSchedulingActor(params.workspaceId)
  if (isResponse(actor)) return actor

  try {
    const workspace = await getWorkspace(params.workspaceId)
    const body = await request.json()
    const settings = await saveSchedulingSettings({
      actor,
      businessModel: (workspace as any).businessModel,
      settings: body.settings,
    })
    return schedulingApiSuccess({ settings })
  } catch (error) {
    return schedulingErrorResponse(error)
  }
}

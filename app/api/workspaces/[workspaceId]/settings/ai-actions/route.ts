import { NextResponse, type NextRequest } from 'next/server'
import { WorkspaceMemberRole } from '@prisma/client'

import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import { logAudit } from '@/lib/audit/log'
import { prisma } from '@/lib/db'
import {
  getWorkspaceSettings,
  setWorkspaceAiActionsEnabled,
} from '@/lib/workspaces/settings'

async function ensureWorkspaceAdmin(workspaceId: string) {
  const guard = await requireWorkspaceRole(workspaceId, [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ])
  if (!guard.allowed) {
    return {
      response: NextResponse.json(
        { error: guard.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: guard.status },
      ),
      guard: null,
    }
  }
  return { response: null, guard }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { response } = await ensureWorkspaceAdmin(params.workspaceId)
  if (response) return response

  const settings = await getWorkspaceSettings(params.workspaceId)

  return NextResponse.json({ aiActionsEnabled: settings.aiActionsEnabled })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { response, guard } = await ensureWorkspaceAdmin(params.workspaceId)
  if (response || !guard) return response

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // ignore, handled below
  }

  if (typeof body.aiActionsEnabled !== 'boolean') {
    return NextResponse.json(
      { error: 'aiActionsEnabled must be a boolean' },
      { status: 400 },
    )
  }

  const settings = await setWorkspaceAiActionsEnabled(
    params.workspaceId,
    body.aiActionsEnabled,
  )

  const actor = await prisma.userProfile.findUnique({
    where: { clerkId: guard.userId },
    select: { id: true },
  })
  await logAudit({
    workspaceId: params.workspaceId,
    actorId: actor?.id ?? null,
    action: 'AI_ACTIONS_SETTING_CHANGED',
    targetType: 'WorkspaceSettings',
    targetId: params.workspaceId,
    meta: { aiActionsEnabled: settings.aiActionsEnabled },
  })

  return NextResponse.json({ aiActionsEnabled: settings.aiActionsEnabled })
}

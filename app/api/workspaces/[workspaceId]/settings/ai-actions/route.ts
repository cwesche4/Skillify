import { NextResponse, type NextRequest } from 'next/server'
import { WorkspaceMemberRole } from '@prisma/client'

import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import {
  getWorkspaceSettings,
  setWorkspaceAiActionsEnabled,
} from '@/lib/workspaces/settings'

async function ensureWorkspaceAdmin(workspaceId: string) {
  try {
    await requireWorkspaceRole(workspaceId, [
      WorkspaceMemberRole.OWNER,
      WorkspaceMemberRole.ADMIN,
    ])
    return null
  } catch (err: any) {
    const message = err?.message ?? ''
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const adminGuard = await ensureWorkspaceAdmin(params.workspaceId)
  if (adminGuard) return adminGuard

  const settings = await getWorkspaceSettings(params.workspaceId)

  return NextResponse.json({ aiActionsEnabled: settings.aiActionsEnabled })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const adminGuard = await ensureWorkspaceAdmin(params.workspaceId)
  if (adminGuard) return adminGuard

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

  return NextResponse.json({ aiActionsEnabled: settings.aiActionsEnabled })
}

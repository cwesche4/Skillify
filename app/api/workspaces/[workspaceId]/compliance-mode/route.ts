import { NextResponse } from 'next/server'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import {
  getComplianceMode,
  setComplianceMode,
} from '@/lib/workspaces/complianceMode'

// Compliance mode.
// Explicit workspace setting.
// No hidden changes.
export async function GET(
  _: Request,
  { params }: { params: { workspaceId: string } },
) {
  const guard = await requireWorkspaceRole(params.workspaceId, [
    'owner',
    'admin',
    'member',
  ])
  if (!guard.allowed)
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status })
  return NextResponse.json({ enabled: getComplianceMode(params.workspaceId) })
}

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const guard = await requireWorkspaceRole(params.workspaceId, [
    'owner',
    'admin',
  ])
  if (!guard.allowed)
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status })
  const body = await req.json()
  setComplianceMode(params.workspaceId, !!body.enabled)
  return NextResponse.json({ enabled: getComplianceMode(params.workspaceId) })
}

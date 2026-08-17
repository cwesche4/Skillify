import { NextResponse } from 'next/server'
import {
  getWorkspaceFlags,
  setWorkspaceFlags,
  type FeatureFlag,
} from '@/lib/enterprise/featureFlags'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'

// Enterprise feature flags.
// Explicit, documented, non-inferential.
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
  return NextResponse.json({ flags: getWorkspaceFlags(params.workspaceId) })
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
  const body = (await req.json()) as { flags: FeatureFlag[] }
  setWorkspaceFlags(params.workspaceId, body.flags ?? [])
  return NextResponse.json({ flags: getWorkspaceFlags(params.workspaceId) })
}

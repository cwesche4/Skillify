import { NextResponse } from 'next/server'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import {
  getWorkspacePolicies,
  setWorkspacePolicies,
} from '@/lib/workspaces/policies'

// Change control.
// Explicit policy gates only.
// No inference.
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
  return NextResponse.json({
    policies: getWorkspacePolicies(params.workspaceId),
  })
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
  setWorkspacePolicies(params.workspaceId, {
    requirePublishApproval: !!body.requirePublishApproval,
    requireProdEditApproval: !!body.requireProdEditApproval,
    requireSecretBindingApproval: !!body.requireSecretBindingApproval,
    bulkEditApprovalThreshold:
      typeof body.bulkEditApprovalThreshold === 'number'
        ? body.bulkEditApprovalThreshold
        : undefined,
  })
  return NextResponse.json({
    ok: true,
    policies: getWorkspacePolicies(params.workspaceId),
  })
}

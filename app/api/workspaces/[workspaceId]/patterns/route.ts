import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import {
  listWorkspacePatterns,
  saveWorkspacePattern,
} from '@/lib/workspaces/patternStore'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'

// Workspace patterns.
// Explicit sharing only.
// No dependencies or live updates.
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
  const patterns = listWorkspacePatterns(params.workspaceId)
  return NextResponse.json({ patterns })
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
  const now = new Date().toISOString()
  saveWorkspacePattern({
    id: nanoid(),
    workspaceId: params.workspaceId,
    name: body.name,
    purpose: body.purpose,
    inputs: body.inputs ?? [],
    outputs: body.outputs ?? [],
    nodes: body.nodes ?? [],
    edges: body.edges ?? [],
    createdAt: now,
  })
  return NextResponse.json({ ok: true })
}

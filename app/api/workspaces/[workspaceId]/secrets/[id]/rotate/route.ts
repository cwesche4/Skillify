import { NextResponse } from 'next/server'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'

// Secrets vault.
// Never return plaintext secrets after creation.
// References only in flows.
export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string; id: string } },
) {
  const guard = await requireWorkspaceRole(params.workspaceId, ['owner'])
  if (!guard.allowed)
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status })
  await req.json().catch(() => ({}))
  return NextResponse.json(
    {
      ok: false,
      enabled: false,
      reason: 'Workspace secret storage not configured',
    },
    { status: 501 },
  )
}

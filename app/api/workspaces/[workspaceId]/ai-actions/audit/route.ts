import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { WorkspaceMemberRole } from '@prisma/client'

import { prisma } from '@/lib/db'
import { queryAiActionAudits } from '@/lib/builder/ai/server/auditQuery'
import { requireWorkspaceRole } from '@/lib/auth/requireWorkspaceRole'

function parseDate(value: string | null) {
  if (!value) return undefined
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? undefined : new Date(ts)
}

function parseBoolean(value: string | null) {
  if (value === null) return undefined
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return undefined
}

export async function GET(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile)
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 },
    )

  await requireWorkspaceRole(profile.id, params.workspaceId, [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ])

  const url = new URL(req.url)
  const from = parseDate(url.searchParams.get('from'))
  const to = parseDate(url.searchParams.get('to'))
  const wasDenied = parseBoolean(url.searchParams.get('wasDenied'))

  const audits = await queryAiActionAudits(params.workspaceId, {
    from,
    to,
    actorUserId: url.searchParams.get('actorUserId') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    nodeId: url.searchParams.get('nodeId') ?? undefined,
    automationId: url.searchParams.get('automationId') ?? undefined,
    wasDenied,
  })

  return NextResponse.json({ audits })
}

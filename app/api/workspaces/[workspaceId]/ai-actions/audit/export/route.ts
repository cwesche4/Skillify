import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { queryAiActionAudits } from '@/lib/builder/ai/server/auditQuery'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import { toCsv, appendCsvFooter } from '@/lib/export/csv'
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

const HEADERS = [
  'timestamp',
  'workspaceId',
  'automationId',
  'nodeId',
  'actorUserId',
  'action',
  'wasDenied',
  'reason',
]

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

  const guard = await requireWorkspaceRole(params.workspaceId, [
    'owner',
    'admin',
  ])
  if (!guard.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status })
  }

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

  const rows = audits.map((a: any) => ({
    timestamp: a.createdAt.toISOString(),
    workspaceId: a.workspaceId,
    automationId: a.automationId ?? '',
    nodeId: a.nodeId ?? '',
    actorUserId: a.actorUserId,
    action: a.action,
    wasDenied: a.wasDenied,
    reason: a.reason ?? '',
  }))

  const csv = appendCsvFooter(toCsv(rows, HEADERS), {
    generatedAt: new Date().toISOString(),
    workspaceId: params.workspaceId,
    exportedBy: profile.id,
  })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ai-action-audit-${params.workspaceId}.csv"`,
    },
  })
}

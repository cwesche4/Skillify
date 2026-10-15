import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { WorkspaceMemberRole } from '@prisma/client'
import JSZip from 'jszip'
import { queryAiActionAudits } from '@/lib/builder/ai/server/auditQuery'
import { toCsv, appendCsvFooter } from '@/lib/export/csv'
import { CONTROL_REGISTRY } from '@/lib/compliance/controlRegistry'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'

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
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const guard = await requireWorkspaceRole(params.workspaceId, [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ])
  if (!guard.allowed) {
    return NextResponse.json(
      { error: guard.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: guard.status },
    )
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const wasDenied = url.searchParams.get('wasDenied')

  const audits = await queryAiActionAudits(params.workspaceId, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    actorUserId: url.searchParams.get('actorUserId') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    nodeId: url.searchParams.get('nodeId') ?? undefined,
    automationId: url.searchParams.get('automationId') ?? undefined,
    wasDenied:
      wasDenied === 'true' ? true : wasDenied === 'false' ? false : undefined,
  })

  const rows = audits.map((a) => ({
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
    exportedBy: 'system', // evidence bundle is system-generated
  })

  const zip = new JSZip()
  zip.file('audit.csv', csv)
  zip.file(
    'control-registry.json',
    JSON.stringify({ controls: CONTROL_REGISTRY }, null, 2),
  )
  zip.file(
    'runbooks.txt',
    [
      'See docs/runbooks/ai-actions.md for incident steps.',
      'See docs/compliance/soc2-ai-governance.md for evidence walkthrough.',
    ].join('\n'),
  )

  const content = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="ai-evidence-${params.workspaceId}.zip"`,
    },
  })
}

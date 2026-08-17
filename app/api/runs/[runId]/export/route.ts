import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redactTimeline } from '@/lib/runs/export/redact'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'
import type { TimelineItem } from '@/lib/runs/timeline/types'

// Compliance export.
// Redacted evidence only.
// No secrets or payloads by default.
export async function GET(
  _: Request,
  { params }: { params: { runId: string } },
) {
  const run = await prisma.automationRun.findUnique({
    where: { id: params.runId },
    include: { automation: true },
  })
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const guard = await requireWorkspaceRole(run.automation.workspaceId, [
    'owner',
    'admin',
  ])
  if (!guard.allowed)
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status })

  const events = await prisma.automationRunEvent.findMany({
    where: { runId: run.id },
    orderBy: { createdAt: 'asc' },
  })

  const timeline: TimelineItem[] = events.map((ev) => ({
    id: ev.id,
    type: 'node-completed',
    status: ev.status.toLowerCase() as any,
    timestamp: ev.createdAt.toISOString(),
    title: ev.message ?? ev.nodeType,
    subtitle: ev.path ?? undefined,
    details: ev.nodeId ? { nodeId: ev.nodeId } : undefined,
  }))

  return NextResponse.json({
    run: {
      id: run.id,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      status: run.status,
    },
    timeline: redactTimeline(timeline),
  })
}

import { NextResponse } from 'next/server'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'
import type { RunEvent } from '@/lib/runtime/types'

export async function GET(
  req: Request,
  { params }: { params: { automationId: string } },
) {
  const { automationId } = params
  const access = await authorizeAutomationAccess({
    automationId,
    access: 'view',
  })
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status },
    )
  }

  const runRecords = await prisma.automationRun.findMany({
    where: {
      automationId,
      workspaceId: access.automation.workspaceId,
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      automationId: true,
      startedAt: true,
      finishedAt: true,
    },
  })
  const runs = runRecords.map((run) => ({
    id: run.id,
    automationId: run.automationId,
    startedAt: run.startedAt.getTime(),
    finishedAt: run.finishedAt?.getTime(),
  }))

  const requestedRunId = new URL(req.url).searchParams.get('runId')
  const selectedRunId = requestedRunId ?? runRecords[0]?.id
  const selectedRun = selectedRunId
    ? await prisma.automationRun.findFirst({
        where: {
          id: selectedRunId,
          automationId,
          workspaceId: access.automation.workspaceId,
        },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      })
    : null

  if (requestedRunId && !selectedRun) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const events: RunEvent[] =
    selectedRun?.events.map((event) => ({
      nodeId: event.nodeId,
      status: event.status === 'PENDING' ? 'RUNNING' : event.status,
      timestamp: event.createdAt.getTime(),
      duration: 0,
    })) ?? []

  return NextResponse.json({
    runs,
    timeline: selectedRun
      ? {
          runId: selectedRun.id,
          startedAt: selectedRun.startedAt.getTime(),
          finishedAt: (
            selectedRun.finishedAt ?? selectedRun.startedAt
          ).getTime(),
          events,
        }
      : null,
  })
}

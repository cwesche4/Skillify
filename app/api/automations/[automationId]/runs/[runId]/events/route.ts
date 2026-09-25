import { fail, ok } from '@/lib/api/responses'
import {
  authorizeAutomationAccess,
  buildAutomationRunScope,
} from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: { automationId: string; runId: string } },
) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'view',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const run = await prisma.automationRun.findFirst({
    where: buildAutomationRunScope({
      runId: params.runId,
      automationId: params.automationId,
      workspaceId: access.automation.workspaceId,
    }),
    select: { id: true },
  })
  if (!run) return fail('Run not found', 404)

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const cursorDate = cursor ? new Date(cursor) : null
  if (cursorDate && Number.isNaN(cursorDate.getTime())) {
    return fail('Invalid cursor', 400)
  }

  const events = await prisma.automationRunEvent.findMany({
    where: {
      runId: run.id,
      createdAt: cursorDate ? { gt: cursorDate } : undefined,
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })

  const nextCursor =
    events.length > 0
      ? events[events.length - 1]?.createdAt.toISOString()
      : cursor

  return ok({ events, nextCursor })
}

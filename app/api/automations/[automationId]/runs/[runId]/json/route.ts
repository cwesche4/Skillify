// app/api/automations/[automationId]/runs/[runId]/json/route.ts
import {
  authorizeAutomationAccess,
  buildAutomationRunScope,
} from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'

interface Params {
  params: { automationId: string; runId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'view',
  })
  if (!access.allowed) {
    return new Response(access.message, { status: access.status })
  }

  const run = await prisma.automationRun.findFirst({
    where: buildAutomationRunScope({
      runId: params.runId,
      automationId: params.automationId,
      workspaceId: access.automation.workspaceId,
    }),
    include: { events: true },
  })

  if (!run) {
    return new Response('Run not found', { status: 404 })
  }

  const payload = {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    log: run.log,
    events: run.events,
  }

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="automation-run-${run.id}.json"`,
    },
  })
}

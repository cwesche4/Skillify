// app/api/automations/[automationId]/runs/[runId]/route.ts
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
    access: 'manage',
  })
  if (!access.allowed) {
    return new Response(JSON.stringify({ error: access.message }), {
      status: access.status,
    })
  }

  const run = await prisma.automationRun.findFirst({
    where: buildAutomationRunScope({
      runId: params.runId,
      automationId: params.automationId,
      workspaceId: access.automation.workspaceId,
    }),
    select: {
      id: true,
      status: true,
      log: true,
      startedAt: true,
      finishedAt: true,
      automation: {
        select: { id: true, name: true },
      },
    },
  })

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
    })
  }

  return new Response(JSON.stringify({ run }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

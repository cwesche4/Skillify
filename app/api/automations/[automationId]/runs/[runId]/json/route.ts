// app/api/automations/[automationId]/runs/[runId]/json/route.ts
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

interface Params {
  params: { automationId: string; runId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const run = await prisma.automationRun.findUnique({
    where: { id: params.runId },
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

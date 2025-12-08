// app/api/automations/[automationId]/runs/[runId]/route.ts
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

interface Params {
  params: { automationId: string; runId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    })
  }

  const run = await prisma.automationRun.findUnique({
    where: { id: params.runId },
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

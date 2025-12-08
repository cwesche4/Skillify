// app/api/automations/[automationId]/flow/route.ts
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'

interface Params {
  params: { automationId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    })
  }

  const automation = await prisma.automation.findUnique({
    where: { id: params.automationId },
    select: {
      id: true,
      name: true,
      flow: true,
    },
  })

  if (!automation) {
    return new Response(JSON.stringify({ error: 'Automation not found' }), {
      status: 404,
    })
  }

  return new Response(
    JSON.stringify({
      id: automation.id,
      name: automation.name,
      flow: automation.flow ?? { nodes: [], edges: [] },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export async function PUT(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    })
  }

  const body = await req.json()

  // Very basic validation: expect nodes & edges arrays
  const flow = {
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    edges: Array.isArray(body.edges) ? body.edges : [],
  }

  const automation = await prisma.automation.update({
    where: { id: params.automationId },
    data: { flow },
    select: { id: true, name: true, flow: true },
  })

  return new Response(JSON.stringify({ automation }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

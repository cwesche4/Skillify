// app/api/automations/[automationId]/route.ts
import { auth } from '@clerk/nextjs/server'

import { fail, ok } from '@/lib/api/responses'
import { prisma } from '@/lib/db'

interface Params {
  params: { automationId: string }
}

export async function GET(_: Request, { params }: Params) {
  const automation = await prisma.automation.findUnique({
    where: { id: params.automationId },
    include: { runs: true },
  })

  if (!automation) return fail('Not found', 404)

  return ok(automation)
}

export async function PATCH(req: Request, { params }: Params) {
  const { automationId } = params
  const body = await req.json()

  const updated = await prisma.automation.update({
    where: { id: automationId },
    data: body,
  })

  return ok(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  await prisma.automation.delete({
    where: { id: params.automationId },
  })

  return ok({ deleted: true })
}

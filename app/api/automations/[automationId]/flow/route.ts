// app/api/automations/[automationId]/flow/route.ts
import { Prisma } from '@prisma/client'
import { fail, ok } from '@/lib/api/responses'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { prisma } from '@/lib/db'
import { automationFlowSchema } from '@/lib/validations/automation'
import { getAdvancedAutomationMutationError } from '@/lib/automations/policy'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

interface Params {
  params: { automationId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)

  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
    select: {
      id: true,
      name: true,
      status: true,
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
      status: automation.status,
      flow: automation.flow ?? { nodes: [], edges: [] },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export async function PUT(req: Request, { params }: Params) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)
  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) return fail(ownershipError, 409)

  const parsed = automationFlowSchema.safeParse(
    await req.json().catch(() => null),
  )
  if (!parsed.success)
    return fail('Flow must contain nodes and edges arrays', 400)

  const updated = await prisma.automation.updateMany({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
    data: { flow: parsed.data as Prisma.InputJsonValue },
  })
  if (updated.count !== 1) return fail('Automation not found', 404)

  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
    select: { id: true, name: true, status: true, flow: true },
  })
  return ok({ automation })
}

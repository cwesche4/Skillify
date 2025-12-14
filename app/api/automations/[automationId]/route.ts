// app/api/automations/[automationId]/route.ts
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api/responses'
import { logAudit } from '@/lib/audit/log'

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
  const { userId: clerkId } = auth()
  if (!clerkId) return fail('Unauthorized', 401)

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) return fail('User not found', 404)

  const body = await req.json().catch(() => ({}))

  const before = await prisma.automation.findUnique({
    where: { id: params.automationId },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      status: true,
      updatedAt: true,
    },
  })
  if (!before) return fail('Not found', 404)

  const updated = await prisma.automation.update({
    where: { id: params.automationId },
    data: body,
  })

  // 🔒 AUDIT LOG — AUTOMATION UPDATED
  await logAudit({
    workspaceId: updated.workspaceId,
    actorId: profile.id,
    action: 'AUTOMATION_UPDATED',
    targetType: 'Automation',
    targetId: updated.id,
    meta: {
      name: updated.name,
      changedFields: Object.keys(body ?? {}),
      // keep this light; no secrets / huge payloads
      before: {
        name: before.name,
        status: before.status,
      },
      after: {
        name: updated.name,
        status: updated.status,
      },
    },
  })

  return ok(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  const { userId: clerkId } = auth()
  if (!clerkId) return fail('Unauthorized', 401)

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) return fail('User not found', 404)

  const automation = await prisma.automation.findUnique({
    where: { id: params.automationId },
  })
  if (!automation) return fail('Not found', 404)

  await prisma.automation.delete({
    where: { id: params.automationId },
  })

  // 🔒 AUDIT LOG — AUTOMATION DELETED
  await logAudit({
    workspaceId: automation.workspaceId,
    actorId: profile.id,
    action: 'AUTOMATION_DELETED',
    targetType: 'Automation',
    targetId: automation.id,
    meta: { name: automation.name },
  })

  return ok({ deleted: true })
}

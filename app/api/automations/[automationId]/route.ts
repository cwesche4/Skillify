// app/api/automations/[automationId]/route.ts
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api/responses'
import { logAudit } from '@/lib/audit/log'
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import {
  getAutomationActivationError,
  getAdvancedAutomationMutationError,
  getAutomationStatusTransitionError,
} from '@/lib/automations/policy'
import { updateAutomationSchema } from '@/lib/validations/automation'

interface Params {
  params: { automationId: string }
}

export async function GET(_: Request, { params }: Params) {
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
    include: {
      runs: {
        where: { workspaceId: access.automation.workspaceId },
        orderBy: { startedAt: 'desc' },
        take: 100,
      },
    },
  })

  if (!automation) return fail('Not found', 404)
  return ok(automation)
}

export async function PATCH(req: Request, { params }: Params) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)
  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) return fail(ownershipError, 409)

  const parsed = updateAutomationSchema.safeParse(
    await req.json().catch(() => null),
  )
  if (!parsed.success) return fail('Unsupported or invalid update fields', 400)
  if (Object.keys(parsed.data).length === 0) {
    return fail('No supported update fields provided', 400)
  }

  const before = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      status: true,
      flow: true,
      updatedAt: true,
    },
  })
  if (!before) return fail('Not found', 404)

  if (parsed.data.status) {
    const transitionError = getAutomationStatusTransitionError(
      before.status,
      parsed.data.status,
    )
    if (transitionError) return fail(transitionError, 409)
    const activationError = getAutomationActivationError(
      parsed.data.status,
      before.flow,
    )
    if (activationError) return fail(activationError, 409)
  }

  const updated = await prisma.automation.updateMany({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
    data: parsed.data,
  })
  if (updated.count !== 1) return fail('Not found', 404)

  const after = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
  })
  if (!after) return fail('Not found', 404)

  // 🔒 AUDIT LOG — AUTOMATION UPDATED
  await logAudit({
    workspaceId: after.workspaceId,
    actorId: access.userProfileId,
    action: 'AUTOMATION_UPDATED',
    targetType: 'Automation',
    targetId: after.id,
    meta: {
      name: after.name,
      changedFields: Object.keys(parsed.data),
      // keep this light; no secrets / huge payloads
      before: {
        name: before.name,
        status: before.status,
      },
      after: {
        name: after.name,
        status: after.status,
      },
    },
  })

  return ok(after)
}

export async function DELETE(_: Request, { params }: Params) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) return fail(access.message, access.status)
  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) return fail(ownershipError, 409)

  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
  })
  if (!automation) return fail('Not found', 404)

  const deleted = await prisma.automation.deleteMany({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
  })
  if (deleted.count !== 1) return fail('Not found', 404)

  // 🔒 AUDIT LOG — AUTOMATION DELETED
  await logAudit({
    workspaceId: automation.workspaceId,
    actorId: access.userProfileId,
    action: 'AUTOMATION_DELETED',
    targetType: 'Automation',
    targetId: automation.id,
    meta: { name: automation.name },
  })

  return ok({ deleted: true })
}

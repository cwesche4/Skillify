import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { runAutomation } from '@/lib/automations/executor'

export async function clearCircuitBreaker(
  integrationId: string,
  workspaceId: string,
  actorId?: string,
) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  })
  const meta = (integration?.metadata as any) || {}
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      metadata: {
        ...meta,
        breakerOpen: false,
        breakerOpenedAt: null,
        failures: [],
      },
    },
  })

  await logAudit({
    workspaceId,
    actorId,
    action: 'CRM_CIRCUIT_RESET',
    targetType: 'Integration',
    targetId: integrationId,
    meta: { integrationId },
  })
}

export async function softDisableIntegration(
  integrationId: string,
  workspaceId: string,
  disabled: boolean,
  actorId?: string,
) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  })
  const meta = (integration?.metadata as any) || {}
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      metadata: { ...meta, disabled },
    },
  })

  await logAudit({
    workspaceId,
    actorId,
    action: disabled ? 'CRM_DISABLED' : 'CRM_ENABLED',
    targetType: 'Integration',
    targetId: integrationId,
    meta: { integrationId },
  })
}

/**
 * Best-effort re-run: replays the automation for the last failed CRM action.
 * Assumes meta.automationId is present in the failure audit record.
 */
export async function rerunLastFailedAction(
  integrationId: string,
  workspaceId: string,
  actorId?: string,
) {
  const lastFail = await prisma.auditLog.findFirst({
    where: {
      workspaceId,
      targetId: integrationId,
      action: 'CRM_ACTION_FAILED',
    },
    orderBy: { createdAt: 'desc' },
  })

  const automationId = (lastFail?.meta as any)?.automationId
  if (!automationId) {
    return { ok: false, reason: 'No failed action with automationId' }
  }

  try {
    await runAutomation(automationId)
    await logAudit({
      workspaceId,
      actorId,
      action: 'CRM_ACTION_REPLAYED',
      targetType: 'Integration',
      targetId: integrationId,
      meta: { integrationId, automationId },
    })
    return { ok: true }
  } catch (err: any) {
    await logAudit({
      workspaceId,
      actorId,
      action: 'CRM_ACTION_REPLAY_FAILED',
      targetType: 'Integration',
      targetId: integrationId,
      meta: { integrationId, automationId, error: err?.message },
    })
    return { ok: false, reason: err?.message ?? 'replay failed' }
  }
}

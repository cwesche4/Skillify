import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { normalizeCRMAuditMeta } from '@/lib/integrations/auditMeta'

const WINDOW_MS = 10 * 60 * 1000
const FAIL_THRESHOLD = 5

export async function recordFailure(
  integrationId: string,
  workspaceId: string,
  provider: string,
  error?: string,
) {
  const now = Date.now()
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  })
  const meta = (integration?.metadata as any) || {}
  const failures: number[] = (meta.failures ?? []).filter(
    (t: number) => now - t < WINDOW_MS,
  )
  failures.push(now)

  let breakerOpen = meta.breakerOpen ?? false
  let breakerOpenedAt = meta.breakerOpenedAt ?? null

  if (!breakerOpen && failures.length >= FAIL_THRESHOLD) {
    breakerOpen = true
    breakerOpenedAt = now
    await logAudit({
      workspaceId,
      action: 'CRM_CIRCUIT_OPENED',
      targetType: 'Integration',
      targetId: integrationId,
      meta: normalizeCRMAuditMeta({
        provider,
        integrationId,
        failures: failures.length,
      }),
    })
  }

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      metadata: {
        ...meta,
        failures,
        breakerOpen,
        breakerOpenedAt,
        lastError: error ?? meta.lastError ?? null,
      },
    },
  })

  return { breakerOpen, breakerOpenedAt }
}

export async function resetBreakerIfNeeded(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  })
  const meta = (integration?.metadata as any) || {}
  if (!meta.breakerOpen) return { breakerOpen: false }

  const openedAt = meta.breakerOpenedAt ? Number(meta.breakerOpenedAt) : null
  if (!openedAt) return { breakerOpen: true }

  const now = Date.now()
  if (now - openedAt >= WINDOW_MS) {
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
    return { breakerOpen: false, reset: true }
  }
  return { breakerOpen: true }
}

export async function isBreakerOpen(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  })
  const meta = (integration?.metadata as any) || {}
  return !!meta.breakerOpen
}

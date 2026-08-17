import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { upsertExternalRecord } from '@/lib/integrations/externalRecords'
import { matchTriggerNode } from '@/lib/integrations/normalize'
import type {
  IntegrationProvider,
  IntegrationWebhookPayload,
} from '@/lib/integrations/types'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { resetBreakerIfNeeded } from '@/lib/integrations/circuit'
import { runAutomation } from '@/lib/automations/executor'
import { normalizeCRMAuditMeta } from '@/lib/integrations/auditMeta'
import { classifyCRMError } from '@/lib/integrations/failureCategory'

type ProcessResult =
  | { ok: true; triggered: number }
  | { ok: false; status: number; error: string }

/**
 * Shared webhook processing pipeline used by real webhooks and dev simulators.
 * - Resolves the integration by provider (and portal/hubId if provided)
 * - Enforces Elite plan for inbound webhooks
 * - Circuit breaker + rate caps
 * - Dedupe protection (per automation via audit meta)
 * - Triggers automations with crm-trigger nodes
 */
export async function processWebhookPayload(
  provider: IntegrationProvider,
  payload: IntegrationWebhookPayload,
  opts: { workspaceId?: string } = {},
): Promise<ProcessResult> {
  // Guardrail: kill switches checked before any CRM work to avoid blocking the HTTP thread
  // Resolve integration/workspace by portal/hubId if available
  const portalId =
    (payload as any).portalId ?? (payload as any).accountId ?? null
  const integration = portalId
    ? await prisma.integration.findFirst({
        where: {
          provider,
          status: 'connected',
          workspaceId: opts.workspaceId ?? undefined,
          metadata: {
            path: ['hubId'],
            equals: portalId,
          } as any,
        },
      })
    : await prisma.integration.findFirst({
        where: {
          provider,
          status: 'connected',
          workspaceId: opts.workspaceId ?? undefined,
        },
      })

  if (!integration) {
    return { ok: false, status: 404, error: 'No active integration' }
  }

  // Kill switches (env-driven, lazy) — now we can audit with workspace context
  if (
    process.env.CRM_DISABLE_ALL === 'true' ||
    process.env.CRM_DISABLE_INBOUND === 'true'
  ) {
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_REJECTED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        reason: 'Inbound disabled via env',
        integrationId: integration.id,
        failureCategory: classifyCRMError('Inbound CRM disabled'),
      }),
    })
    return { ok: false, status: 202, error: 'Inbound CRM disabled' }
  }

  const meta = (integration.metadata as any) || {}
  if (meta.disabled) {
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_REJECTED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        reason: 'Integration manually disabled',
        integrationId: integration.id,
        failureCategory: classifyCRMError('Integration disabled'),
      }),
    })
    return { ok: false, status: 202, error: 'Integration disabled' }
  }

  const plan = await getWorkspacePlan(integration.workspaceId)
  if (plan !== 'Elite') {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...(integration.metadata as any),
          lastError: 'Elite plan required',
        },
      },
    })
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_REJECTED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        reason: 'Plan insufficient (Elite required)',
        integrationId: integration.id,
        failureCategory: classifyCRMError('Elite plan required'),
      }),
    })
    return { ok: false, status: 403, error: 'Elite plan required for webhooks' }
  }

  // Payload guards
  const sizeLimit = 256 * 1024
  if (payload.rawLength && payload.rawLength > sizeLimit) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...(integration.metadata as any),
          lastError: 'Payload too large',
        },
      },
    })
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_RATE_LIMITED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        objectType: payload.objectType,
        externalId: payload.externalId,
        event: payload.event,
        integrationId: integration.id,
        reason: 'Payload too large',
        rawLength: payload.rawLength,
        failureCategory: classifyCRMError('Payload too large'),
      }),
    })
    return { ok: false, status: 413, error: 'Webhook payload too large' }
  }

  const eventsCount = payload.eventCount ?? 1
  const eventLimit = 50
  if (eventsCount > eventLimit) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...(integration.metadata as any),
          lastError: 'Webhook event burst',
        },
      },
    })
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_RATE_LIMITED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        objectType: payload.objectType,
        externalId: payload.externalId,
        event: payload.event,
        integrationId: integration.id,
        reason: 'Event burst',
        eventCount: eventsCount,
        cappedAt: eventLimit,
        failureCategory: classifyCRMError('Event burst'),
      }),
    })
    return { ok: false, status: 429, error: 'Too many events in webhook batch' }
  }

  // Circuit breaker check/reset
  const breaker = await resetBreakerIfNeeded(integration.id)
  const breakerOpen = breaker.breakerOpen
  if (breaker.reset) {
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_CIRCUIT_RESET',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({ provider, integrationId: integration.id }),
    })
  }
  if (breakerOpen) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...(integration.metadata as any),
          lastError: 'Circuit open',
        },
      },
    })
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_RATE_LIMITED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        objectType: payload.objectType,
        externalId: payload.externalId,
        event: payload.event,
        integrationId: integration.id,
        reason: 'Circuit open',
        failureCategory: classifyCRMError('Circuit open'),
      }),
    })
    return { ok: false, status: 202, error: 'Circuit open' }
  }

  await logAudit({
    workspaceId: integration.workspaceId,
    action: 'CRM_WEBHOOK_RECEIVED',
    targetType: 'Integration',
    targetId: integration.id,
    meta: normalizeCRMAuditMeta({
      provider,
      objectType: payload.objectType,
      externalId: payload.externalId,
      event: payload.event,
      integrationId: integration.id,
      failureCategory: 'unknown',
    }),
  })

  await upsertExternalRecord({
    workspaceId: integration.workspaceId,
    provider,
    objectType: payload.objectType,
    externalId: payload.externalId,
    integrationId: integration.id,
    localType: null,
    localId: null,
  })

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      metadata: {
        ...(integration.metadata as any),
        lastWebhookAt: new Date().toISOString(),
        lastError: null,
      },
    },
  })

  // Trigger automations with matching CRM trigger nodes
  const automations = await prisma.automation.findMany({
    where: {
      workspaceId: integration.workspaceId,
      status: 'ACTIVE',
    },
    select: { id: true, flow: true },
  })

  const matching = automations.filter((a: any) => {
    const flow = a.flow as any
    if (!flow?.nodes) return false
    return flow.nodes.some((n: any) => {
      if (n.type !== 'crm-trigger') return false
      return matchTriggerNode({
        nodeProvider: n.data?.provider ?? payload.provider,
        nodeObjectType: n.data?.objectType ?? payload.objectType,
        nodeEvent: n.data?.event ?? payload.event,
        eventProvider: payload.provider,
        eventObjectType: payload.objectType,
        eventName: payload.event,
      })
    })
  })

  // Soft rate limit: cap automation fan-out
  const RATE_LIMIT = 25
  if (matching.length > RATE_LIMIT) {
    await logAudit({
      workspaceId: integration.workspaceId,
      action: 'CRM_WEBHOOK_RATE_LIMITED',
      targetType: 'Integration',
      targetId: integration.id,
      meta: normalizeCRMAuditMeta({
        provider,
        objectType: payload.objectType,
        externalId: payload.externalId,
        event: payload.event,
        count: matching.length,
        cappedAt: RATE_LIMIT,
        integrationId: integration.id,
        failureCategory: classifyCRMError('rate limit'),
      }),
    })
  }

  const toRun = matching.slice(0, RATE_LIMIT)

  // Dedup guard: avoid triggering same automation twice for same external event
  const dedupeKey = `${payload.provider}:${payload.objectType}:${payload.externalId}:${payload.event}:${(payload as any).occurredAt ?? ''}`

  let fired = 0
  for (const a of toRun) {
    try {
      const already = await prisma.auditLog.findFirst({
        where: {
          workspaceId: integration.workspaceId,
          action: 'CRM_TRIGGER_FIRED',
          targetId: a.id,
          meta: {
            path: ['dedupeKey'],
            equals: dedupeKey,
          } as any,
        },
      })
      if (already) continue

      await runAutomation(a.id, {
        triggerPayload: {
          provider,
          objectType: payload.objectType,
          event: payload.event,
          externalId: payload.externalId,
          occurredAt: (payload as any).occurredAt ?? Date.now(),
          raw: payload.payload,
        },
        userProfileId: null,
      })

      fired += 1

      await logAudit({
        workspaceId: integration.workspaceId,
        action: 'CRM_TRIGGER_FIRED',
        targetType: 'Integration',
        targetId: a.id,
        meta: normalizeCRMAuditMeta({
          provider,
          objectType: payload.objectType,
          externalId: payload.externalId,
          event: payload.event,
          automations: [a.id],
          dedupeKey,
          integrationId: integration.id,
          automationId: a.id,
          failureCategory: 'unknown',
        }),
      })
    } catch (err) {
      console.error('Failed to run automation from CRM webhook', err)
    }
  }

  if (toRun.length === 0) {
    console.warn(
      `CRM webhook received for ${payload.objectType} but no matching automations found.`,
    )
  }

  return { ok: true, triggered: fired }
}

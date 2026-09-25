import { createHash } from 'crypto'

import { z } from 'zod'

import type { IntegrationWebhookPayload } from '@/lib/integrations/types'

export const HUBSPOT_WEBHOOK_TOPIC = 'integration.hubspot.webhook'
export const HUBSPOT_WEBHOOK_AGGREGATE_TYPE = 'HubSpotIntegration'

export const durableHubSpotWebhookPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  integrationId: z.string().min(1),
  webhook: z.object({
    provider: z.literal('hubspot'),
    objectType: z.enum(['contact', 'deal', 'company', 'owner']),
    externalId: z.string().min(1),
    event: z.enum([
      'contact.created',
      'contact.updated',
      'contact.deleted',
      'deal.stage_changed',
      'deal.created',
      'deal.deleted',
      'lead.assigned',
      'company.created',
      'company.updated',
      'company.deleted',
      'created',
      'updated',
      'deleted',
      'stage_changed',
    ]),
    payload: z.unknown(),
    occurredAt: z.number().optional(),
    eventId: z.string().optional(),
    portalId: z.union([z.string(), z.number()]).nullable().optional(),
    rawLength: z.number().optional(),
    eventCount: z.number().optional(),
  }),
})

export function hubSpotWebhookEventIdentity(
  integrationId: string,
  payload: IntegrationWebhookPayload,
) {
  const providerIdentity = [payload.eventId, payload.occurredAt]
    .filter((value) => value !== undefined && value !== null)
    .join(':')
  const fallbackIdentity = createHash('sha256')
    .update(JSON.stringify(payload.payload ?? null))
    .digest('hex')
  return [
    'hubspot-webhook',
    integrationId,
    payload.objectType,
    payload.externalId,
    payload.event,
    providerIdentity || fallbackIdentity,
  ].join(':')
}

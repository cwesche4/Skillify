// lib/integrations/templates/index.ts
// CRM template registry (infrastructure-only, no UI wiring yet).
// These presets are used to seed automation builder flows for CRM use cases.

import type { Plan } from '@/lib/subscriptions/features'

export type CRMTemplateNode = {
  id: string
  type: string
  data?: Record<string, any>
}

export type CRMTemplateEdge = {
  id: string
  source: string
  target: string
}

export type CRMTemplate = {
  id: string
  name: string
  description: string
  provider: 'hubspot'
  requiredPlan: Plan // Pro for outbound actions, Elite for webhooks
  nodes: CRMTemplateNode[]
  edges: CRMTemplateEdge[]
}

const hubspotTemplates: CRMTemplate[] = [
  {
    id: 'hubspot-sync-contacts',
    name: 'Sync new HubSpot contacts to automation',
    description:
      'Fire when a new HubSpot contact is created and push it into your workflow.',
    provider: 'hubspot',
    requiredPlan: 'Elite', // inbound webhooks require Elite
    nodes: [
      {
        id: 'trigger-1',
        type: 'crm-trigger',
        data: {
          provider: 'hubspot',
          objectType: 'contact',
          event: 'contact.created',
          label: 'When a HubSpot contact is created',
        },
      },
      {
        id: 'action-1',
        type: 'crm-action',
        data: {
          provider: 'hubspot',
          action: 'contact.update',
          objectType: 'contact',
          payload: {
            // placeholder for mapping — builder should prompt user
            properties: {
              lifecycle_stage: 'lead',
            },
          },
        },
      },
    ],
    edges: [
      {
        id: 'e-trigger-action',
        source: 'trigger-1',
        target: 'action-1',
      },
    ],
  },
  {
    id: 'hubspot-update-deal-on-success',
    name: 'Update deal stage on automation success',
    description: 'After automation completes, advance the HubSpot deal stage.',
    provider: 'hubspot',
    requiredPlan: 'Pro', // outbound actions only
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger', // generic automation trigger (e.g., manual/run)
        data: {
          label: 'When automation starts',
        },
      },
      {
        id: 'action-1',
        type: 'crm-action',
        data: {
          provider: 'hubspot',
          action: 'deal.update_stage',
          objectType: 'deal',
          payload: {
            externalId: '{{dealId}}', // builder should replace with user mapping
            properties: {
              dealstage: '{{targetStage}}',
            },
          },
        },
      },
    ],
    edges: [
      {
        id: 'e-trigger-action',
        source: 'trigger-1',
        target: 'action-1',
      },
    ],
  },
]

export function getCRMTemplates() {
  return hubspotTemplates
}

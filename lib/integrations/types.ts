export type IntegrationProvider = 'hubspot' | 'salesforce' | 'pipedrive'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

export type CRMObjectType = 'contact' | 'deal' | 'company' | 'owner'

export type CRMTrigger =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'deal.stage_changed'
  | 'deal.created'
  | 'deal.deleted'
  | 'lead.assigned'
  | 'company.created'
  | 'company.updated'
  | 'company.deleted'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'stage_changed'

export type CRMAction =
  | 'contact.create'
  | 'contact.update'
  | 'note.create'
  | 'deal.update_stage'

export type IntegrationActionResult = {
  ok: boolean
  data?: any
  error?: string
}

export interface IntegrationWebhookPayload {
  provider: IntegrationProvider
  objectType: CRMObjectType
  externalId: string
  event: CRMTrigger
  payload: any
  occurredAt?: number
  workspaceId?: string
  integrationId?: string
  portalId?: string | number | null
  rawLength?: number
  eventCount?: number
}

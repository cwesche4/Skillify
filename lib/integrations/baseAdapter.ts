import type {
  CRMAction,
  CRMObjectType,
  CRMTrigger,
  IntegrationActionResult,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationWebhookPayload,
} from './types'

export type {
  IntegrationWebhookPayload,
  IntegrationActionResult,
} from './types'

export interface IntegrationContext {
  workspaceId: string
  integrationId: string
  provider: IntegrationProvider
  credentials?: {
    accessToken: string
    refreshToken?: string | null
    expiresAt?: Date | null
  }
}

export interface IntegrationAdapter {
  provider: IntegrationProvider
  // REQUIRED: Connect/disconnect should prepare/store tokens; no-ops allowed if handled elsewhere.
  connect(ctx: IntegrationContext): Promise<IntegrationStatus>
  disconnect(ctx: IntegrationContext): Promise<IntegrationStatus>
  // REQUIRED: Advertise triggers/actions this provider supports.
  listTriggers(): CRMTrigger[]
  listActions(): CRMAction[]
  // OPTIONAL: Lightweight connectivity check.
  testConnection?(ctx: IntegrationContext): Promise<boolean>
  // REQUIRED: Execute a CRM action. Must never throw; return { ok:false, error } on failure.
  executeAction(
    ctx: IntegrationContext,
    action: CRMAction,
    params: Record<string, any>,
  ): Promise<IntegrationActionResult>
  // OPTIONAL: CRUD helpers for providers that expose them.
  listObjects?(objectType: CRMObjectType): Promise<any>
  createObject?(
    ctx: IntegrationContext,
    objectType: CRMObjectType,
    payload: Record<string, any>,
  ): Promise<IntegrationActionResult>
  updateObject?(
    ctx: IntegrationContext,
    objectType: CRMObjectType,
    externalId: string,
    payload: Record<string, any>,
  ): Promise<IntegrationActionResult>
  findObjectByExternalId?(
    ctx: IntegrationContext,
    objectType: CRMObjectType,
    externalId: string,
  ): Promise<IntegrationActionResult>
  // REQUIRED: Verify webhook signature and normalize to IntegrationWebhookPayload (or return null).
  verifyWebhook(req: Request): Promise<IntegrationWebhookPayload | null>
}

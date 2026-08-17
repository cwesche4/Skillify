import type {
  IntegrationAdapter,
  IntegrationActionResult,
  IntegrationContext,
  IntegrationWebhookPayload,
} from '../baseAdapter'
import type { CRMAction, CRMTrigger, CRMObjectType } from '../types'

const NOT_IMPL = 'Salesforce adapter not implemented'

const TRIGGERS: CRMTrigger[] = [
  'contact.created',
  'contact.updated',
  'deal.stage_changed',
  'lead.assigned',
]
const ACTIONS: CRMAction[] = [
  'contact.create',
  'contact.update',
  'deal.update_stage',
  'note.create',
]

export const salesforceAdapter: IntegrationAdapter = {
  provider: 'salesforce',
  // TODO: implement OAuth + API calls. Stub only.
  async connect(_ctx: IntegrationContext) {
    throw new Error(NOT_IMPL)
  },
  async disconnect(_ctx: IntegrationContext) {
    throw new Error(NOT_IMPL)
  },
  listTriggers(): CRMTrigger[] {
    return TRIGGERS
  },
  listActions(): CRMAction[] {
    return ACTIONS
  },
  async testConnection(_ctx: IntegrationContext): Promise<boolean> {
    return false
  },
  async executeAction(
    _ctx: IntegrationContext,
    _action: CRMAction,
    _params: Record<string, any>,
  ): Promise<IntegrationActionResult> {
    return { ok: false, error: NOT_IMPL }
  },
  async verifyWebhook(
    _req: Request,
  ): Promise<IntegrationWebhookPayload | null> {
    return null
  },
}

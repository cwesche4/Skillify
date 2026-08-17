type EntitlementCrmEvent = {
  workspaceId: string
  entitlementKey: string
  action:
    | 'ENTITLEMENT_GRANTED'
    | 'ENTITLEMENT_REVOKED'
    | 'ENTITLEMENT_EXPIRED'
    | 'CONTRACT_AMENDED'
    | 'SECURITY_PACK_ENABLED'
  effectiveAt: Date
  source: string
  idempotencyKey?: string
}

/**
 * Placeholder CRM hook emitter.
 * Sends metadata only (no payloads/PII). Implement actual delivery via webhook/queue.
 */
export async function emitEntitlementCrmEvent(_event: EntitlementCrmEvent) {
  // intentionally left as a no-op stub; hook up to CRM/message bus as needed
  return
}

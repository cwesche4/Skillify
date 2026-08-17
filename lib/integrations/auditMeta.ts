// Normalizes CRM audit metadata without mutating input or removing fields.
// Ensures common keys exist when provided. Never throws.
export type CRMAuditMeta = Record<string, any> & {
  provider?: string
  integrationId?: string
  automationId?: string
}

export function normalizeCRMAuditMeta(input: CRMAuditMeta): CRMAuditMeta {
  try {
    const meta = { ...(input || {}) }
    if (input?.provider) meta.provider = input.provider
    if (input?.integrationId) meta.integrationId = input.integrationId
    if (input?.automationId) meta.automationId = input.automationId
    return meta
  } catch {
    // Fail open: return input as-is to avoid blocking audit logging
    return input
  }
}

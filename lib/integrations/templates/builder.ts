// lib/integrations/templates/builder.ts
// Helper to expose CRM templates to the automation builder (read-only).
// No UI wiring or schema changes here; the builder can consume these as presets.

import { getCRMTemplates } from './index'

export function getBuilderCRMTemplates() {
  return getCRMTemplates()
}

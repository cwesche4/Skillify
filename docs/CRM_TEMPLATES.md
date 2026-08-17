# CRM Templates (Presets)

These are read-only JSON presets that seed CRM automation flows. No schema or runtime changes.

## Location

- `lib/integrations/templates/index.ts` — registry + types
- `lib/integrations/templates/builder.ts` — helper to expose templates to the builder

## Current templates (HubSpot)

1. **Sync new HubSpot contacts to automation**
   - Provider: `hubspot`
   - Required plan: **Elite** (inbound webhooks)
   - Nodes: `crm-trigger` (contact.created) → `crm-action` (contact.update)
2. **Update deal stage on automation success**
   - Provider: `hubspot`
   - Required plan: **Pro** (outbound action)
   - Nodes: generic `trigger` → `crm-action` (deal.update_stage)

## How to consume (builder)

- Use `getBuilderCRMTemplates()` to fetch presets.
- Do **not** auto-insert; present as selectable presets.
- Builder should map placeholders (e.g., `externalId`, `properties`) to user-configured fields.

## Guardrails

- Respect plan gating: Pro for outbound actions, Elite for inbound.
- Do not mutate templates at runtime; clone before editing.
- No database writes are required for templates.

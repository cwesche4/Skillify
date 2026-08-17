# CRM Activity Timeline (Read-Only)

Read-only view of CRM events sourced **only** from audit logs. No new APIs or mutations.

## Data source

- `AuditLog` rows with actions starting `CRM_` (e.g., `CRM_WEBHOOK_RECEIVED`, `CRM_TRIGGER_FIRED`, `CRM_ACTION_EXECUTED`, `CRM_ACTION_FAILED`, `CRM_WEBHOOK_RATE_LIMITED`, `CRM_CIRCUIT_OPENED`, `CRM_CIRCUIT_RESET`).
- Filter by `workspaceId` and, when scoped to an automation, `meta.automationId`.

## Current UI surface

- `app/dashboard/[workspaceSlug]/automations/[automationId]/page.tsx` — Elite-only panel showing timeline entries for that automation.

## Rules

- Read-only; no actions or mutations.
- Elite-gated (webhook visibility).
- No new API: reuse existing audit queries.
- Use audit `meta` to surface provider/objectType/event/externalId/integrationId/automationId.

## Extending

- You can render timelines in other views by querying the same audit data with appropriate filters.
- Do not store CRM payloads; only reference IDs and metadata already logged.

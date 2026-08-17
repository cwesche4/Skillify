# CRM Incident Playbook

Operator guide for common CRM integration issues (HubSpot).

## Kill switches

- `CRM_DISABLE_ALL=true` — disables inbound + actions (webhooks return 202, actions noop). Audited.
- `CRM_DISABLE_INBOUND=true` — webhooks return 202 and audit `CRM_WEBHOOK_REJECTED`.
- `CRM_DISABLE_ACTIONS=true` — crm-action nodes skip, audit `CRM_ACTION_FAILED` with reason.
- Reflected in `/api/integrations/diagnostics?workspaceId=...` and health endpoints.

## Webhooks failing

- Check audit log for `CRM_WEBHOOK_REJECTED` / `CRM_WEBHOOK_RATE_LIMITED`.
- Validate Elite plan and that circuit is not open.
- Use diagnostics endpoint to view `lastError` and breaker state.
- For local tests, use dev-only simulator: `POST /api/integrations/hubspot/simulate-webhook`.

## Circuit open

- Triggered after repeated failures; actions skipped.
- Clear manually via helper `clearCircuitBreaker(integrationId, workspaceId)` (lib/integrations/ops.ts).
- Health/diagnostics show `breakerOpen` and failure count.

## OAuth broken

- Ensure env keys: `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`, `INTEGRATIONS_ENCRYPTION_KEY` (base64 32 bytes).
- Retry connect; audit log should show `CRM_CONNECTED` on success.

## Plan mismatch

- Webhooks require Elite; actions require Pro+.
- Audit entries will show plan rejection.
- Upgrade plan or disable CRM (kill switch) to avoid noise.

## Rollback/Recovery

- Soft-disable integration: `softDisableIntegration(integrationId, workspaceId, true)`; re-enable with `false`.
- Clear circuit: `clearCircuitBreaker(...)`.
- Replay last failed CRM action (best-effort): `rerunLastFailedAction(...)` (requires automationId in last failure).
- Use `/api/integrations/diagnostics` to confirm breaker closed and errors cleared.

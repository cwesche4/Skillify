# CRM Operations (Production)

Operator-focused notes for running CRM integrations (HubSpot live; Salesforce/Pipedrive stubs).

## Failure categories (meta only)

- `transient`: timeouts, rate limits, network (ECONN/ETIMEDOUT/429).
- `auth`: 401/unauthorized/invalid or expired tokens.
- `config`: plan/kill-switch/disabled integration blocks.
- `provider`: upstream CRM errors (4xx/5xx/HubSpot failures).
- `unknown`: anything else.

Classification is stored in audit meta; no behavior changes.

## Circuit breaker lifecycle

- Tracks recent failures per integration (sliding window).
- Opens after repeated failures; webhooks/actions are logged but skipped.
- Auto-resets after quiet period; audit entries: `CRM_CIRCUIT_OPENED`, `CRM_CIRCUIT_RESET`.
- Circuit state stored in integration metadata (no schema changes).

## Kill switch matrix

- `CRM_DISABLE_ALL=true`: inbound + actions short-circuit; audit: `CRM_WEBHOOK_REJECTED` / `CRM_ACTION_FAILED` with reason.
- `CRM_DISABLE_INBOUND=true`: webhooks return 202; no execution.
- `CRM_DISABLE_ACTIONS=true`: crm-action nodes no-op; audit failure recorded.
- Kill switches are checked before CRM logic to avoid blocking HTTP threads.

## Audit log interpretation

- Webhooks: `CRM_WEBHOOK_RECEIVED`, `CRM_WEBHOOK_REJECTED`, `CRM_WEBHOOK_RATE_LIMITED`, `CRM_TRIGGER_FIRED`.
- Actions: `CRM_ACTION_EXECUTED`, `CRM_ACTION_FAILED`, `CRM_EXECUTION_TIMEOUT`, `CRM_ACTION_RATE_LIMITED`.
- Circuit: `CRM_CIRCUIT_OPENED`, `CRM_CIRCUIT_RESET`.
- Tokens: `CRM_TOKEN_REFRESHED`.
- Meta fields commonly present:
  - `provider`, `integrationId`, `automationId` (when applicable)
  - `failureCategory` (see above)
  - `reason` / `error` / `timeoutMs`
  - `deferred` markers for expected long-running actions (prep only, no worker)

## Ops surfaces

- Health: `/api/integrations/{provider}/health?workspaceId=...` (Owner/Admin).
- Diagnostics: `/api/integrations/diagnostics?workspaceId=...` (Owner/Admin).
- CRM Ops page (Admin → System → CRM Ops, Elite): read-only counts/trends from audit logs.
- Activity timelines: automation detail + integration settings (Elite) — read-only.

# Automation Reliability (Phase 11)

## Failure attribution

- Stored in audit meta only; no behavior change.
- Sources: `trigger`, `crm-trigger`, `crm-action`, `non-crm-action`, `unknown`.
- Used to understand where a run failed; does not alter execution.

## Execution guardrails

- Max nodes per run: 200 (audit: `AUTOMATION_GUARD_NODES`).
- Max depth per path: 12 (audit: `AUTOMATION_GUARD_DEPTH`).
- CRM action caps remain: per-run CRM action rate limit + circuit breaker.
- Guard intent: stop runaway flows gracefully and log the reason; no retries are added.

## Circuit + kill switches (CRM)

- Circuit breaker skips actions/webhooks when open; audits `CRM_CIRCUIT_OPENED` / `CRM_CIRCUIT_RESET`.
- Kill switches short-circuit early: `CRM_DISABLE_ALL`, `CRM_DISABLE_INBOUND`, `CRM_DISABLE_ACTIONS`.
- No schema or behavior changes beyond guards and logging.

## Audit interpretation (automation-focused)

- Guardrails: `AUTOMATION_GUARD_DEPTH`, `AUTOMATION_GUARD_NODES`.
- CRM events: `CRM_TRIGGER_FIRED`, `CRM_ACTION_EXECUTED`, `CRM_ACTION_FAILED`, `CRM_EXECUTION_TIMEOUT`, `CRM_ACTION_RATE_LIMITED`.
- Failure metadata: `failureSource` (attribution), `failureCategory` (CRM classification), optional `deferred` markers (prep for long-running actions, no worker yet).

## Read-only timelines

- Automation detail pages show unified timelines (Elite) sourced purely from audit logs.
- No payload storage; only metadata and IDs.

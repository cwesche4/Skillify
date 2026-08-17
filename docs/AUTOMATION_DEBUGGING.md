# Automation Debugging (Phase 11)

## Debug mode (opt-in, env)

- Controlled by `AUTOMATION_DEBUG_MODE=true`.
- Adds safe debug metadata to audit logs (IDs only, no raw CRM payloads).
- Defaults OFF; no behavior change when disabled.

## What is logged

- Node context hints: `nodeType`, `action`, `objectType`, `integrationId`, `automationId`.
- CRM errors still use `failureCategory` (transient/auth/config/provider/unknown) and `failureSource` (trigger/crm-trigger/crm-action/non-crm-action/unknown).
- Deferred markers (`deferred`, `deferReason`, `expectedMs`) are informational only; execution remains synchronous.

## Guardrails while debugging

- Guardrails stay active: max nodes/depth, CRM caps, circuit breaker, kill switches.
- Timelines and dashboards remain read-only; no payloads are stored.

## How to inspect

- Audit logs: filter by `CRM_` actions and debug meta fields.
- Unified timelines (Elite) show CRM and guardrail events for runs.
- Diagnostics/health endpoints remain unchanged; debug mode does not expose payload data.

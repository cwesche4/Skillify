# SLOs (Contracts Only) — Phase 12

These Service Level Objectives use existing audit logs only. No enforcement or infra is added; they define what “healthy” means for CRM + Automation.

## CRM Webhooks

- Availability: 99.9%
- Acceptance latency: P95 < 2s (acknowledge request, not full processing)
- Error budget: ≤ 0.1% `CRM_WEBHOOK_REJECTED` (excluding plan blocks)

## CRM Actions

- Success rate: ≥ 99% per workspace
- Timeout rate: ≤ 0.5% (`CRM_EXECUTION_TIMEOUT`)
- Circuit breaker opens: < 3 per workspace / 24h (`CRM_CIRCUIT_OPENED`)

## Automation Runs

- Completion rate: ≥ 98% (SUCCESS vs FAILED)
- Max execution depth hit: < 0.1% (`AUTOMATION_GUARD_DEPTH`)
- Max node cap hit: < 0.1% (`AUTOMATION_GUARD_NODES`)

Notes

- All metrics are derived solely from existing audit events; no new schema or runtime changes.
- These are contracts for monitoring/alerting readiness, not active enforcement.

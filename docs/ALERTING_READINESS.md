# ALERTING_READINESS

Policy-only outline for future alerting. No integrations, cron jobs, or new infra added.

## Principles

- Derive signals from existing audit logs and SLO helpers.
- Keep severity simple: Info, Warning, Critical.
- Scope by workspace to avoid noisy global alerts.

## Triggers (what & when)

- Circuit breaker opened ≥3 times in 1h (per workspace) → Critical.
- CRM webhook SLO breach (availability <99.9% over last window) for 2 consecutive windows → Warning.
- CRM action success rate <99% over last window → Warning; <97% → Critical.
- CRM execution timeouts >0.5% over last window → Warning.
- CRM auth failures spike: ≥5 auth errors in 30m → Critical.
- Kill switch engaged (CRM_DISABLE_ALL or per-integration disabled flag) → Info (record and notify ops).
- Automation guardrails hit (max nodes/depth) >0.1% of runs in last window → Warning.

## Who (notification targets)

- Critical: on-call ops/engineering.
- Warning: platform team mailing list or ops channel.
- Info: logged for later review; optionally posted to low-priority channel.

## Future implementation notes (not done now)

- Use SLO helper outputs (lib/ops/slo.ts) and audit log aggregates as data sources.
- Keep alerts rate-limited and deduped; per-workspace routing to avoid global noise.
- No payloads in alerts; include identifiers (workspaceId, integrationId, automationId) only.

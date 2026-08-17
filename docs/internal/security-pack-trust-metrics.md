# Trust & Compliance Metrics (Internal) — Security Pack

Aggregated, internal-only metrics for executive visibility. No vanity, no customer exposure.

## Metrics (Definitions)

- **Security Pack requests:** Count of requests over a period (aggregated).
- **Approval vs rejection rate:** Ratio of APPROVED vs REJECTED audit events (append-only).
- **Time-to-delivery (informational):** Time from REQUEST_SUBMITTED to DELIVERY_MARKED (no SLA framing; median/percentile only).
- **Escalations:** Count of Compliance/Legal escalations (e.g., requests for packet/readiness or contract exceptions).
- **Trust Center link usage in deals:** Count of deals where Trust Center link was shared (tracked in CRM notes; no customer-level exposure).

## Exec-Ready Summary (Usage)

- Present as trends/aggregates only; no customer identifiers.
- Use to spot friction (e.g., high rejections, long delivery times) without implying SLAs.
- Use to ensure Trust Center is leveraged (link usage) and to monitor escalation load.

## Alert Thresholds (Informational Only)

- **Rejection rate spike:** If rejection rate increases materially vs baseline, flag for review (no automatic action).
- **Delivery time drift:** If median time-to-delivery drifts upward meaningfully, flag for investigation (no SLA).
- **Escalation volume:** If escalations exceed a set internal threshold, review enablement materials.

## Guardrails

- No customer-level reporting; aggregated only.
- No SLA commitments; metrics are informational.
- No vanity metrics; focus on operational signals that improve trust posture.

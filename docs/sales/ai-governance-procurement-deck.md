# AI Governance Procurement Deck (Slide Content)

## Slide 1: AI Governance Overview

- AI assists workspace automation configuration under server-side controls.
- Workspace-scoped actions; no cross-workspace access.
- Immediate disablement paths exist (global and per-workspace).

## Slide 2: Risk Controls Summary

- Server-enforced kill switches, rate limits, and membership checks.
- Audits with integrity hashes and undo protections.
- Alerts for denial spikes, rate limits, and undo conflicts.

## Slide 3: Kill Switches & Access Controls

- Platform-wide kill switch (environment controlled) plus workspace toggle.
- Admin-only access to AI settings; AI endpoints require workspace context.
- Denials return explicit 503/403 when disabled.

## Slide 4: Auditability & Integrity

- Every AI action/denial logged with before/after snapshots.
- Integrity hashes and undo chaining for tamper evidence.
- Exportable CSV and evidence bundle for reviews.

## Slide 5: Monitoring & Incident Readiness

- Structured metrics for attempted/applied/denied/undone/rate-limited events.
- Threshold-based alerts for abnormal patterns.
- Runbooks and tabletop exercises support incident handling; AI can be halted instantly.

## Slide 6: Compliance & Evidence

- SOC-2 readiness packet and auditor walkthrough available.
- Audit CSV export and evidence ZIP endpoints.
- Control registry documents enforcement locations.

## Slide 7: Customer Assurance Summary

- Server-side enforcement; no payloads in metrics/alerts.
- Workspace isolation and clear error responses on disablement.
- Customers can toggle AI per workspace and export audits on demand.

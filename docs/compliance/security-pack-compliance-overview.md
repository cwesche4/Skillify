# Security Pack Compliance Overview

This document summarizes the Security Pack compliance posture and evidence references for auditors and enterprise reviewers.

## Cross-Reference Table

| Topic                   | Evidence                                                                                                 | Location                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| SOC-2 narrative         | Narrative of controls, monitoring, incident handling                                                     | `docs/compliance/security-pack-soc2-narrative.md`            |
| Evidence index          | Control → evidence mapping and walkthrough                                                               | `docs/compliance/security-pack-soc2-evidence-index.md`       |
| Executive diagram       | System flow, guarantees/non-guarantees, control ownership                                                | `docs/exec/security-pack-system-overview.md`                 |
| Entitlement enforcement | Route-level entitlements and concealment rules                                                           | `docs/security-pack/entitlement-enforcement-final.md`        |
| Delay disclaimer        | Timeline footnote (“Events are generated automatically and may be delayed during approval or delivery.”) | API timeline response (`GET /api/security-pack/request/:id`) |

## Auditor Checklist (Read-Only Verification)

- Verify entitlement enforcement:
  - Attempt Security Pack routes without entitlements; expect 403/404 per concealment rules.
  - Confirm `hasWorkspaceEntitlement` gating in request, download/artifact, audit feed, approvals.
- Verify audit immutability:
  - Inspect `SecurityPackAuditEvent` for append-only records; confirm ordering in `GET /api/security-pack/request/:id`.
  - Inspect `EntitlementAuditEvent` for entitlement changes; verify history API pagination/export.
- Verify governance safeguards:
  - Confirm NDA validation events on request creation when `ndaConfirmed` is false.
  - Confirm delivery callback idempotency (single `DELIVERY_MARKED` event).
  - Confirm 404 concealment for unauthorized/undelivered downloads.
- Verify entitlement transparency:
  - `GET /api/workspaces/:id/entitlements` shows contract entitlements with effective/expiry and sources.
  - `GET /api/workspaces/:id/entitlements/history` returns append-only change log; CSV export available via `format=csv`.
- Verify delay disclaimer:
  - Timeline API response includes the footnote indicating events may be delayed and no SLA is implied.

## Summary

Security Pack controls are enforced by contract entitlements (not plan names or UI toggles), audited via append-only logs, and exposed through read-only APIs for timelines, entitlements, and history. Downloads and artifacts require delivery events plus entitlements, with 404 concealment to avoid leakage. The artifacts above provide end-to-end evidence for SOC-2 and enterprise procurement reviews.

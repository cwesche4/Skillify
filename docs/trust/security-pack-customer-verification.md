# Security Pack Customer Self-Verification Playbook

Enable customers to verify controls independently. Read-only; no internal access or editable records.

## Verification Paths

- **Entitlements:** Read-only view of current entitlements and history (contract-based; no self-service).
- **Timelines:** Read-only timeline of request/approval/delivery events (append-only; ordered).
- **Exports:** On-demand, point-in-time exports (e.g., CSV timelines/history) available after delivery; not stored.

## Common Questions → Trust Center Mapping

- “Is this self-service?” → Trust Center: Access Control (contract entitlements only).
- “How are approvals enforced?” → Trust Center: Approvals & Governance (append-only approval events).
- “Are audit logs mutable?” → Trust Center: Audit & Evidence Integrity (append-only, metadata-only).
- “How are downloads gated?” → Trust Center: Data Handling (entitlement + delivery; 404/403 concealment).
- “Can we export evidence?” → Trust Center: Customer Transparency (read-only, point-in-time exports).
- “What about SOC-2?” → Trust Center: Non-Guarantees (alignment only; no certification promises).

## What Customers Cannot Verify (and Why)

- Internal systems, tokens, or automation internals (security).
- Editable audit records (append-only by design).
- SLAs or guaranteed approvals (explicitly not offered).
- Live data feeds or stored URLs (not retained; exports are snapshots).

## If Something Looks Wrong

- Compare against the Trust Center statements (access, approvals, audit, downloads).
- Provide the observed read-only export/timeline to support review.
- Contact the compliance/support channel for investigation; do not expect live edits (append-only).
- No changes are made in place; discrepancies are resolved via new events/entitlements, not edits.

## Sales Handoff Version (Auditor-Safe)

- Share Trust Center link for posture.
- Provide instructions for read-only entitlements/timelines/exports after delivery.
- Reinforce non-guarantees: no SLAs, no self-service toggles, no certification promises.
- Avoid meetings unless customer cannot complete self-verification; escalate to Compliance if questions persist.

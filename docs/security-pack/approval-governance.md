# Security Pack Approval Governance

Defensible, auditable approval workflow. Event-sourced only; no mutable request state.

## Principles

- No auto-approval; every decision is an explicit audit event.
- No mutable status fields; approvals/rejections are append-only events.
- No bypass paths; requester cannot approve their own request.
- Reviewer role enforcement (Security/Legal/GRC); approvals recorded with actor + role + timestamp (SLA-neutral).
- Optional quorums can be derived by consumers from event history (no inline mutation).

## Approval Decision Route

- `POST /api/security-pack/request/:id/decision`
- Enforces: authenticated reviewer role, separation of duties (no self-approval), append-only audit event (`APPROVED`/`REJECTED`) with actor attribution and notes.
- SLA-neutral response; audit event is source of truth.

## Reviewer Audit Events

- Stored in `SecurityPackAuditEvent` as append-only entries with `eventType`, `actorUserId`, `actorRole`, `decisionNotes`, `createdAt`.
- No updates/deletes; ordering by `createdAt`.

## Inbox UX Guardrails

- Do not show mutable status; render timeline from audit events.
- Show reviewer role and timestamp from audit events; no implied SLAs.
- Block self-approval actions; only reviewer roles can act.
- Quorum (if needed) should be computed from audit events, not UI state.

## Rollback/Dispute Handling

- Rollback = new audit event (e.g., REJECTED after APPROVED) by authorized reviewer; no deletion.
- Disputes resolved via timeline review; requester cannot alter approvals.

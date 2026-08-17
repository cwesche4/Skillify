# Security Pack Evidence Lifecycle & Custody

No payload retention; append-only audit preserved. Custody is explainable to auditors.

## Lifecycle States (Text Diagram)

```
Requested → Approved → Delivered → (Optional) Rejected → (Implicit) Archived via contract expiry
   |            |            |
   |            |            v
   |            |         Exported (read-only snapshot)
   v            v
Rejected (if not approved)
```

- Requested: created via SecurityPackRequest (no status mutation).
- Approved/Rejected: represented by append-only audit events.
- Delivered: recorded as audit event after approval + entitlement.
- Exported: point-in-time snapshot generated on demand (not stored).
- Archived: access ceases when entitlements expire/contract ends; audit logs remain append-only.

## State Transition Table

| From      | Event             | To                     | Triggered By                            | Audit Event                           |
| --------- | ----------------- | ---------------------- | --------------------------------------- | ------------------------------------- |
| Requested | Approval event    | Approved               | Reviewer (Security/Legal/GRC)           | APPROVED                              |
| Requested | Rejection event   | Rejected               | Reviewer (Security/Legal/GRC)           | REJECTED                              |
| Approved  | Delivery callback | Delivered              | Automation with scoped token            | DELIVERY_MARKED                       |
| Approved  | Export requested  | Exported (snapshot)    | Authorized user with entitlement        | N/A (export is generated, not stored) |
| Any       | Contract expiry   | Archived (access ends) | Resolver excluding expired entitlements | EntitlementAuditEvent for expiry      |

## Custody & Triggers

- Creation: Requester submits SecurityPackRequest.
- Approval/Reject: Reviewer roles only; requester cannot self-approve.
- Delivery: Automation callback with scoped token (idempotent); requires approval + entitlement.
- Export: Authorized user with entitlement after delivery; snapshots only, not persisted.
- Revocation/Expiry: Entitlements expire per contract; resolver enforces; audit history retained.

## Auditor Narrative

- Evidence lifecycle is event-sourced: Requested → Approved/Rejected → Delivered → Exported (on demand). No mutable status fields.
- All state changes are append-only audit events (SecurityPackAuditEvent); entitlements are contract-based and time-bound.
- Downloads require both delivery events and entitlements; unauthorized/undelivered requests return 404/403; URLs are not stored.
- Exports are generated on demand as snapshots; they are not retained in audit tables.
- When contracts/entitlements expire, access ends automatically; audit history remains for custody traceability.

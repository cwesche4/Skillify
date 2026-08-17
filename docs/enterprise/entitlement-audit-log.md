# Entitlement Change Audit Log (Contract-Level)

Append-only log for entitlement grants/revocations/amendments, separate from Security Pack request events. Contract-scoped, auditor-readable, no payload or pricing data.

## Prisma Model (proposed)

```prisma
model EntitlementAuditEvent {
  id             String   @id @default(cuid())
  workspaceId    String
  entitlementKey String
  action         EntitlementAuditAction
  source         EntitlementAuditSource
  actorType      EntitlementAuditActorType
  actorId        String?  // optional user/service identifier
  effectiveAt    DateTime
  createdAt      DateTime @default(now())

  @@index([workspaceId, createdAt])
  @@index([workspaceId, entitlementKey, createdAt])
}

enum EntitlementAuditAction {
  GRANTED
  REVOKED
  EXPIRED
}

enum EntitlementAuditSource {
  CONTRACT
  AMENDMENT
  EXCEPTION
  RENEWAL
}

enum EntitlementAuditActorType {
  SYSTEM
  SALES_OPS
  LEGAL
  AUTOMATION
}
```

## Event Semantics

- One event per entitlement change (grant, revoke, expire). No updates/deletes.
- `effectiveAt` captures when the entitlement takes effect; `createdAt` captures when the event was recorded.
- `source` records where the change originated (contract, amendment, exception, renewal).
- `actorType` and optional `actorId` indicate who/what initiated the change; no pricing or payload data is stored.

## Relationship to Entitlement Resolution

- Entitlement resolution reads current contract state (plan + amendments/exceptions), not the audit log.
- The audit log is read-only and exportable for auditors to trace change history.
- No coupling to feature usage or Security Pack request events; this log is strictly for contract entitlement changes.

## API Notes

- Internal-only read endpoint for auditors (workspace-scoped, admin/internal roles).
- No customer-facing exposure; no mutation endpoints.

## SOC-2 / ISO Notes

- Append-only design supports CC7.2/CC7.3 evidence of contract-level control changes.
- Indexes on `workspaceId` and `(workspaceId, entitlementKey, createdAt)` support export and timeline queries at scale.
- No PII or pricing stored; metadata only.

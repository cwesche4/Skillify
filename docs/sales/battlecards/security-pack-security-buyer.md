# Security Pack — Security Buyer Card

## Approval Enforcement

- Approvals/rejections append audit events; no status fields to edit.
- Delivery requires APPROVED events plus entitlements; unauthorized/undelivered returns 403/404.

## Audit Integrity

- Audit logs are append-only and metadata-only; no payloads, no edits/deletes.
- Timelines are ordered and read-only for request/approval/delivery history.

## Evidence Handling

- Downloads are generated on demand; URLs are not stored in audit tables.
- Read-only exports (timelines, entitlement history CSV) available post-delivery for verification.

## Shareable Proof Points

- Entitlement enforcement doc; compliance packet; evidence index.
- SOC-2 alignment: logical access, append-only change tracking, scoped automation tokens.

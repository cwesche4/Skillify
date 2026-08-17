# Security Pack System Overview (Executive, One Page) — v1.0 (2024-06-01)

## Text Diagram (left → right)

```
[Contract & Sales Layer]
  - Enterprise contract
  - Amendments / exceptions
  - Regulated templates
  - Result: Entitlements granted
           |
           v
[Entitlement Resolution Layer]
  - Central entitlement resolver
  - No plan-name checks in product
  - Time-bound exceptions honored
  - Source of truth for access
           |
           v
[Product Enforcement Layer]
  - Security Pack APIs (request, approval inbox, download, audit feed)
  - All routes enforce entitlements + workspace scope
  - 404 concealment for unauthorized access
  - No self-service activation; entitlements, not SKUs
           |
           v
[Governance & Audit Layer]
  - SecurityPackAuditEvent (append-only)
  - EntitlementAuditEvent (contract-level)
  - Immutable timelines; read-only exports
  - Delay disclaimer; no payload storage
           |
           v
[External Systems (Optional)]
  - Automation (n8n callbacks with service tokens)
  - CRM hooks (Salesforce) — metadata only
  - Auditor exports (CSV/evidence bundles)
```

## One-Page Explanation

Security Pack access is defined in Enterprise contracts and any amendments or regulated templates; these grant entitlements (not SKUs) and explicitly disallow self-service activation. A central entitlement resolver is the only source of truth, honoring time-bound exceptions and avoiding plan-name checks. Product enforcement relies on these entitlements at every Security Pack API (request creation, approval inbox, download resolution, audit feed) with workspace scoping and 404 concealment for unauthorized or undelivered access. Governance is enforced via append-only audit logs: SecurityPackAuditEvent for request/approval/delivery and EntitlementAuditEvent for contract-level changes; timelines are immutable, exports are read-only, and payloads are never stored. Optional external integrations (automation callbacks with scoped service tokens, CRM hooks) receive metadata only. Delay disclaimers prevent SLA assumptions, and all controls are auditor-readable.

## Legend

- **Entitlements, not SKUs:** Access is contract-driven; no in-product plan toggles.
- **Append-only audit:** Audit records are never updated or deleted; history is immutable.
- **404 concealment:** Unauthorized or undelivered download attempts return 404 to avoid leaking existence.
- **No payload storage:** Audit and entitlement logs store metadata only; artifacts/URLs are not persisted.

## System Guarantees (Scope-Limited)

- Entitlements are enforced server-side on every Security Pack route; plan names do not grant access.
- Audit logs (request and entitlement events) are append-only and ordered.
- Unauthorized download/timeline access returns 404/403 without revealing existence.
- No payload contents are stored in audit or entitlement records.

## Explicit Non-Guarantees

- No delivery timelines or SLAs are promised.
- Approval outcomes are not guaranteed; reviewer policies apply.
- No guarantee of audit findings or certifications; exports are snapshots at generation time.
- No self-service activation; entitlements change only via contract processes.

## Who Controls What

- **Contracts/Legal/Billing:** Grant/modify entitlements via contract/amendment/exception; system enforces effective/expiry.
- **System Services:** Resolve entitlements, enforce access, emit audit events, and optional CRM hooks.
- **Internal Reviewers (Security/Legal/GRC):** Approve/reject Security Pack requests; actions are audited.
- **Customers (Workspace Admin/Requester):** Submit requests, view timelines/exports when entitled and delivered; cannot change entitlements.

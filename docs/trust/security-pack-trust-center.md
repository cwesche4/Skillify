# Security Pack — Trust Center Copy

Public-facing, plain-English overview of Security Pack controls. No pricing, SLAs, roadmap, or implementation details.

## 1) Overview

- What it is: Security Pack governs how security evidence is requested, approved, and delivered for Enterprise customers using contract-controlled access and audited delivery.
- Problems it solves: provides governed evidence access, audit-ready transparency, and reduces ad-hoc security back-and-forth.
- What it is not: not a self-service toggle, not a certification guarantee, not a promise of delivery timelines.

## 2) Access Control

- Access is granted through contract-based entitlements; there is no self-service activation.
- Enforcement is server-side on every request, approval, download, and audit feed.
- Entitlements are managed via contract processes, not by users in the UI.

## 3) Approvals & Governance

- Requests may require human reviewers (e.g., Security/Legal) before delivery.
- Approvals are recorded as auditable events; delivery occurs only after approval plus entitlement checks.
- There are no bypass mechanisms or editable status fields.

## 4) Audit Logging & Integrity

- All actions are captured in append-only audit logs; entries are not edited or deleted.
- Timelines are immutable and ordered; they show request, approval, and delivery events.
- No payload contents are stored in audit logs.

## 5) Data Handling

- Audit records store metadata only (events, timestamps, linkage); evidence contents are not stored in audit tables.
- Evidence URLs are not persisted; exports are generated on demand.
- Unauthorized or undelivered download attempts return “not found”/forbidden to avoid revealing existence.

## 6) Automation & Integrations

- Automation (e.g., delivery callbacks) uses scoped service tokens, validated server-side.
- Deliveries are idempotent: repeated callbacks after success do nothing.
- Tokens can be rotated or revoked without code changes.

## 7) Customer Transparency

- Customers can view read-only entitlement status and historical changes.
- Request timelines are visible as read-only event histories.
- Exports (e.g., CSV) are available on demand after delivery is recorded.

## 8) Explicit Non-Guarantees

- No delivery SLAs or timelines.
- No guaranteed approvals.
- No certification promises; exports are point-in-time snapshots.

## 9) Frequently Asked Questions

- **Can we enable this ourselves?**  
  No. Access is contract-based and enforced server-side; there is no self-service activation.
- **How do we verify access?**  
  Read-only entitlement views and timelines show current access and historical events; exports can be generated on request.
- **What happens if access expires?**  
  Entitlements follow contract terms and expirations; when expired, access is removed automatically and downloads remain unavailable until renewed.

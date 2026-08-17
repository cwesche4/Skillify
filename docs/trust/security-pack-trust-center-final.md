# Security Pack Trust Center (Public)

## 1) Overview

Security Pack governs how security evidence is requested, approved, and delivered for Enterprise customers. Access is contract-controlled, approvals are role-gated, and actions are audited. It is not a self-service toggle, a certification promise, or a guarantee of delivery timelines.

## 2) Access Control

Access is granted through contract entitlements and enforced server-side on every request, approval, download, and audit feed. There is no self-service activation. Entitlements are managed through contract processes only; nothing in the UI can bypass this.

## 3) Approvals & Governance

Requests may require human reviewers (e.g., Security or Legal). Approvals are recorded as audit events, and delivery occurs only after approval and entitlement checks. There are no bypass mechanisms or editable status fields; approvals are not guaranteed.

## 4) Audit Logging & Integrity

All actions are captured in append-only audit logs; entries are not edited or deleted. Timelines are ordered and read-only. Audit records store metadata only; payload contents are not stored.

## 5) Data Handling

Evidence URLs are not persisted; exports are generated on demand. Unauthorized or undelivered download attempts return “not found” or “forbidden” to avoid revealing existence. Exports are point-in-time snapshots, not live feeds.

## 6) Automation & Integrations

Automation (such as delivery callbacks) uses scoped service tokens validated server-side. Deliveries are idempotent: repeated callbacks after success have no effect. Tokens can be rotated or revoked without code changes.

## 7) Customer Transparency

Customers can view read-only entitlement status and history, and read-only timelines of request, approval, and delivery events. Customers cannot modify entitlements or audit records. Exports (e.g., CSV) are available on demand after delivery is recorded.

## 8) Explicit Non-Guarantees

No delivery SLAs or timelines are offered. Approvals are not guaranteed. No certification is promised; SOC-2 alignment is provided without guarantees. Exports are snapshots, not live data feeds.

---

Last updated: 2024-06-01

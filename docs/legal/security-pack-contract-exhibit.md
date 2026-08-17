# Security Pack Contract Exhibit (Standard)

Standardized exhibit to avoid bespoke rewrites. Mirrors Trust Center and entitlements.

## Exhibit Clauses (Draft, Non-Legal Wording)

- **Scope:** Security Pack entitlements include governed evidence delivery with contract-based access, role-gated approvals, append-only audit records, and gated downloads (entitlement + delivery event).
- **Access Control:** Access is granted via contract entitlements; no self-service activation or plan-based toggles.
- **Approvals:** Approvals/rejections are recorded as audit events; delivery requires approval plus entitlement; no auto-approval or bypass.
- **Audit & Integrity:** Audit records are append-only, metadata-only; timelines are read-only; no edits or deletes.
- **Downloads & Data Handling:** Evidence URLs are not stored; downloads require entitlement and recorded delivery; unauthorized/undelivered requests return “not found/forbidden.”
- **Automation:** Scoped service tokens; idempotent callbacks; tokens revocable/rotatable; no unscoped automation.
- **Non-Guarantees:** No SLAs, no guaranteed approvals, no certification promises; exports are point-in-time snapshots.
- **Expiration & Revocation:** Entitlements and any exceptions expire per contract term/expiry; upon expiry, access is removed automatically. Tokens may be revoked if compromised or upon termination.

## Exception Handling Rules

- Exceptions must be explicit, time-bound (effective/expiry), and stated with the entitlement key.
- No open-ended or “on request” access; no self-service toggles.

## Clause-to-Control Mapping

- Access Control ↔ Trust Center: Access Control; Entitlement model.
- Approvals ↔ Trust Center: Approvals & Governance.
- Audit & Integrity ↔ Trust Center: Audit Logging & Integrity.
- Downloads & Data Handling ↔ Trust Center: Data Handling; Explicit Non-Guarantees.
- Automation ↔ Trust Center: Automation & Integrations.
- Non-Guarantees ↔ Trust Center: Explicit Non-Guarantees.
- Expiration & Revocation ↔ Trust Center: Access Control (contract-entitled).

## Legal Negotiation Guidance

- Can negotiate: explicit inclusion/exclusion of entitlements, time-bound exceptions (with effective/expiry), token revocation procedures if compromised.
- Cannot negotiate: SLAs, certification promises, self-service toggles, custom controls/exports, plan-based access, mutable audit logs.

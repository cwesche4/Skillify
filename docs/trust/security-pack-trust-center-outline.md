# Trust Center Microsite Outline — Security Pack

Public-facing structure; non-technical, precise, and aligned with SOC-2 language. No pricing, SLAs, guarantees, or implementation details.

## Page Map & Section Outlines

### 1. Trust Center Home

- Copy: “How we approach security and governance for Security Pack.” Scope: covers entitlement-based access, approvals, audit transparency; excludes pricing/roadmap.
- Link to Security Pack overview.
- What stays private: internal architecture, APIs, tokens.

### 2. Security Pack Overview

- What it is: governed, contract-entitled delivery of security evidence with role-gated approvals and append-only audits.
- What it is not: self-service toggle, guarantee of approval, certification promise.
- Entitlements-over-SKUs: access is contract-based; no feature switches.
- Private: no internal schemas or API routes.

### 3. Access & Governance

- How access is granted: contract entitlements; no self-service activation.
- Approvals: reviewer roles required; delivery after approval + entitlement checks.
- Why self-service is blocked: to ensure auditable, contract-aligned delivery.
- Private: role definitions, internal tooling.

### 4. Audit & Evidence Integrity

- Append-only audits; timelines are not edited or deleted.
- Timeline transparency: customers can view event history; exports are read-only snapshots.
- No payload storage: audit logs store metadata only.
- 404 concealment: unauthorized or undelivered downloads return “not found” to avoid revealing existence.
- Private: database details, internal audit schemas.

### 5. Automation & Third Parties

- Automation is used for delivery callbacks; controlled via scoped service tokens.
- Idempotency in plain English: repeated deliveries after success do nothing.
- Third-party mention: optional automation; no payload sharing.
- Private: token mechanics, provider configs.

### 6. Transparency for Customers

- What customers can view: entitlement status, request/approval/delivery history, exports on request.
- What customers cannot modify: entitlements, audit records, approvals.
- Disputes: reviewed against append-only timelines and entitlement history.
- Private: internal dispute process details.

### 7. Compliance Alignment

- SOC-2 alignment summary: logical access (entitlements), auditability (append-only logs), automation controls (scoped tokens).
- Evidence available upon request; may be gated.
- Link to compliance packet or contact form (no direct internal doc links).
- Private: raw audit tables, internal controls mapping.

### 8. Limitations & Non-Guarantees (Explicit Page)

- No SLAs or delivery timelines.
- No guaranteed approvals.
- No certification promises.
- Exports are point-in-time snapshots.
- Private: none; this page is explicit and public-safe.

## Safe Language Examples

- “Access is governed by contract entitlements; there is no self-service activation.”
- “Approvals are role-gated and recorded in append-only timelines.”
- “Unauthorized or undelivered download attempts return ‘not found’ to avoid revealing existence.”
- “Audit records store metadata only; evidence exports are generated on demand and are read-only snapshots.”

## Keep Private

- Internal API endpoints, schemas, token handling specifics, and operational tooling.
- Any pricing, SLA, roadmap, or certification claims.
- Internal monitoring/alerting specifics or incident playbooks.

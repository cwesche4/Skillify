# Security Pack System — SOC 2 Control Narrative

## 1. Purpose of the Security Pack System

The Security Pack system provides a governed workflow for preparing and delivering security evidence (e.g., SOC 2 packets, audit CSV exports) to enterprise customers. It is designed to keep delivery auditable, minimize data exposure, and ensure only authorized users can initiate, approve, or retrieve artifacts.

## 2. Request Initiation and Access Control

- Only authenticated users with workspace membership can initiate requests; requests are scoped to a single workspace.
- Enterprise entitlements are enforced server-side; non-entitled plans receive denials and the attempt is logged.
- Request payloads avoid sensitive data; only metadata (workspace, industry, review type, requested artifacts, NDA confirmation) is stored.
- Unauthorized or cross-workspace access attempts return 404/403 without revealing request existence.

## 3. Approval Workflow and Reviewer Roles

- Requests can require human approval (e.g., Security, Legal, GRC). Reviewer roles are enforced server-side; workspace admins do not see the internal approval inbox unless granted reviewer entitlements.
- Approvals and rejections are recorded as append-only audit events; the request record itself is not mutated for status.
- NDA gaps are surfaced via validation events; delivery remains impossible without approval even if a request was submitted without NDA confirmation.

## 4. Immutable Audit Logging

- Every significant action (request submitted, validation failure, approval/rejection, delivery marked) is captured as an append-only `SecurityPackAuditEvent`.
- Audit events include timestamps and request/workspace linkage; no payload contents or PII are stored.
- Integrity is preserved by avoiding updates or deletes; timelines are read-only and ordered by creation time.

## 5. Automation Safeguards (Service Tokens, Idempotency)

- Automation callbacks (e.g., n8n delivery marking) authenticate with scoped service tokens stored as hashes; tokens are compared using constant-time checks and can be revoked.
- Only the delivery callback accepts correlation IDs; creation endpoints reject them to prevent cross-system leakage.
- Delivery callbacks are idempotent: repeated callbacks after a successful response are treated as no-ops to avoid duplicate events.

## 6. Download Controls and Artifact Protection

- Download availability is derived at read time: delivery must be marked via audit event, and the caller must be the requester or a workspace admin with Enterprise entitlement.
- Download URLs are never stored in audit records; short-lived links or internal proxies are generated dynamically.
- Unauthorized, non-delivered, or non-entitled access attempts return 404 to avoid revealing existence; payloads are never returned directly from audit queries.

## 7. Timing and Delay Disclaimer

- Timeline responses include the footnote: “Events are generated automatically and may be delayed during approval or delivery.” This avoids implicit SLAs and clarifies that event timing may lag real-time actions.

## 8. Alignment to SOC 2 CC6 / CC7 Principles

- **CC6 (Logical Access Controls):** Workspace membership checks, enterprise entitlements, reviewer role enforcement, and scoped service tokens restrict who can request, approve, or download.
- **CC7 (Change Management / System Operations):** Append-only audit events create immutable change history; idempotent delivery callbacks and denial-by-default endpoints reduce operational risk; NDA validation events surface policy gaps without bypassing approvals.
- **Data Minimization:** Only metadata required for governance is stored; payload contents and artifacts are not persisted in audit tables.
- **Separation of Duties:** Requesters cannot self-approve unless explicitly granted reviewer roles; internal approval inbox is gated by reviewer entitlements and is not visible to customers.

## 9. Operational Monitoring (CC7.2)

- Delivery callbacks, approvals, denials, and access checks emit structured metrics and alerts for abnormal patterns (e.g., repeated denials or rate-limit hits).
- Alert sinks are configurable; alerts are logged server-side with workspace scope and reason to support investigation.
- Monitoring does not include payload inspection; only event metadata (type, workspace, result, timestamp) is captured.

## 10. Reviewer Accountability (CC7.2)

- Approvals and rejections require authenticated reviewer roles (Security/Legal/GRC) and are captured as discrete audit events.
- Decision notes are optional and stored as metadata; no payload data is captured.
- Internal approval inbox is restricted to reviewer entitlements; all decisions flow through the append-only audit mechanism.

## 11. Audit Log Retention (CC7.3)

- Audit events are append-only with timestamps and integrity considerations; no updates or deletes are supported.
- Audit retention follows the organization’s standard evidence retention policy (documented separately) and is read-only throughout its lifecycle.
- Exports (CSV, evidence bundles) are snapshots generated on demand; exports do not alter live data.

## 12. Incident Escalation (CC7.2 / CC7.3)

- Repeated denials, frequent rate-limit hits, or undo conflicts trigger alert events for operator review.
- Escalation paths direct alerts to designated security operations channels; incidents are handled via documented runbooks and tabletop exercises.
- Global and workspace kill switches remain enforceable during incidents; download endpoints continue to deny-by-default if delivery state or entitlements are missing.

# Enterprise Procurement Security Questionnaire — Security Pack (Final)

Concise, auditor-safe answers mapped to existing controls. No pricing, SLAs, or roadmap statements.

## 1) Access Control

- **Q:** Can customers enable compliance features themselves?  
  **A:** No. Security Pack access is contract-entitlement based; no self-service toggles or plan-name shortcuts. Entitlements are enforced server-side on every route.  
  **Evidence:** `docs/security-pack/entitlement-enforcement-final.md`; `GET /api/workspaces/:id/entitlements`.  
  **Follow-up:** Entitlement mutations require system tokens with `ENTITLEMENT_ADMIN` scope.

## 2) Authentication & Authorization

- **Q:** How are users authenticated and authorized for Security Pack actions?  
  **A:** Clerk authentication is required; workspace membership and entitlements are checked for every request, download, and audit feed. Reviewer routes also require reviewer roles.  
  **Evidence:** Approval inbox documentation; entitlement enforcement summary.  
  **Follow-up:** No customer UI can change entitlements.

## 3) Approval & Governance

- **Q:** How are approval decisions enforced and audited?  
  **A:** Approvals/rejections are recorded as append-only `SecurityPackAuditEvent` entries; no status fields are mutated. Delivery depends on APPROVED/REJECTED events plus entitlements.  
  **Evidence:** `GET /api/security-pack/request/:id`; audit schema; `docs/ui/internal-security-pack-approval-inbox.md`.  
  **Follow-up:** Requesters cannot self-approve unless they also hold reviewer role and entitlement.

## 4) Audit Logging & Integrity

- **Q:** Are audit logs mutable or editable?  
  **A:** No. `SecurityPackAuditEvent` and `EntitlementAuditEvent` are append-only; no update/delete paths. Timelines are ordered by creation time.  
  **Evidence:** `docs/compliance/security-pack-soc2-evidence-index.md`; audit schemas.  
  **Follow-up:** Downloads/URLs are not stored in audit tables.

## 5) Change Management

- **Q:** How are entitlement changes controlled and reviewed?  
  **A:** Entitlements live in `ContractEntitlement`/`ContractException` with effective/expiry and uniqueness constraints; changes are logged in `EntitlementAuditEvent`. Resolver enforces expirations automatically.  
  **Evidence:** `docs/enterprise/entitlement-audit-log.md`; `GET /api/workspaces/:id/entitlements/history?format=csv`.  
  **Follow-up:** Mutations require `ENTITLEMENT_ADMIN` service tokens; no UI mutation.

## 6) Automation & Third-Party Risk

- **Q:** How are third-party automations authenticated and revoked?  
  **A:** Automation callbacks (e.g., n8n) require scoped service tokens (`SECURITY_PACK_DELIVERY`), stored hashed and compared in constant time. Tokens can be revoked in DB, and rotation is supported.  
  **Evidence:** `lib/auth/serviceToken.ts`; `docs/automation/n8n-skillify-bridge.md`.  
  **Follow-up:** Delivery callbacks are idempotent—retries after success are no-ops.

## 7) Data Handling & Retention

- **Q:** Do audit records contain payloads or PII?  
  **A:** No. Audit tables store metadata (event type, timestamps, linkage) only; URLs/artifacts are not stored.  
  **Evidence:** Audit schemas; `docs/compliance/security-pack-soc2-evidence-index.md`.  
  **Follow-up:** Retention policy documented separately (`docs/compliance/evidence-retention-policy.md`).

## 8) Incident & Exception Handling

- **Q:** How do you prevent unauthorized downloads or data leakage?  
  **A:** Downloads require both delivery events and download entitlements; unauthorized or undelivered access returns 404/403 to avoid existence leakage. No URLs are persisted.  
  **Evidence:** Download/artifact route behavior; entitlement enforcement doc.  
  **Follow-up:** Kill switches and entitlement checks remain in effect during incidents.

## 9) Customer Transparency

- **Q:** How can customers independently verify their access?  
  **A:** Read-only APIs expose current entitlements and history; timelines provide request/approval/delivery events. Customers cannot mutate these records.  
  **Evidence:** `GET /api/workspaces/:id/entitlements`; `GET /api/workspaces/:id/entitlements/history?format=csv`; `GET /api/security-pack/request/:id`.  
  **Follow-up:** Disputes can be resolved using these exports without altering data.

## 10) Compliance Alignment (SOC-2)

- **Q:** How do controls align to SOC-2?  
  **A:** Logical access via entitlements (CC6), change/audit via append-only logs and history exports (CC7/CC7.3), automation controls via scoped service tokens and idempotent callbacks (CC7.2).  
  **Evidence:** `docs/compliance/security-pack-soc2-narrative.md`; `docs/compliance/security-pack-soc2-evidence-index.md`.  
  **Follow-up:** No certification guarantees; evidence is provided through the documented APIs and logs.

# Enterprise Procurement Security Questionnaire — Security Pack

Concise, procurement-ready answers mapped to existing controls. No pricing or SLA statements.

## 1) Access Control

- **Q:** Can customers enable compliance features themselves?  
  **A:** No. Security Pack access is contract-entitlement based; there are no self-service toggles. Entitlements are enforced server-side and mutated only via system token–protected processes.  
  **Evidence:** `docs/security-pack/entitlement-enforcement-final.md`; `GET /api/workspaces/:id/entitlements`.  
  **Notes:** Follow-up can include entitlement history CSV for transparency.

## 2) Authentication & Authorization

- **Q:** How are users authenticated and authorized for Security Pack actions?  
  **A:** Clerk authentication is required; workspace membership and entitlements are checked on every route (request, download, audit feed). Reviewer-only routes require reviewer roles plus entitlements.  
  **Evidence:** Timeline/audit routes; approval inbox docs.  
  **Notes:** No customer ability to alter entitlements via UI.

## 3) Audit Logging

- **Q:** How are approval decisions audited?  
  **A:** Approvals/rejections append `SecurityPackAuditEvent` entries; there are no status fields to edit. Timelines are read-only and ordered by createdAt.  
  **Evidence:** `GET /api/security-pack/request/:id`; audit schema.  
  **Notes:** Timeline includes delay disclaimer to avoid SLA assumptions.

- **Q:** Are audit logs mutable?  
  **A:** No. SecurityPackAuditEvent and EntitlementAuditEvent are append-only; no update/delete paths.  
  **Evidence:** `docs/compliance/security-pack-soc2-narrative.md`; audit schemas.  
  **Notes:** Integrity supported by append-only design and DB backups.

## 4) Change Management

- **Q:** How do you manage entitlement changes?  
  **A:** Entitlements are stored in ContractEntitlement/ContractException with effective/expiry dates; changes are recorded in EntitlementAuditEvent (append-only). Resolver honors expirations automatically.  
  **Evidence:** `docs/enterprise/entitlement-audit-log.md`; `GET /api/workspaces/:id/entitlements/history`.  
  **Notes:** Mutation endpoint is system-token only (ENTITLEMENT_ADMIN scope).

## 5) Data Handling & Retention

- **Q:** Do audit records store payloads or PII?  
  **A:** No. Audit tables store metadata only (event types, timestamps, workspace/request linkage). Downloads/URLs are not stored.  
  **Evidence:** Audit schemas; `docs/compliance/security-pack-soc2-evidence-index.md`.  
  **Notes:** Retention policy documented separately (`docs/compliance/evidence-retention-policy.md`).

## 6) Third-Party Integrations

- **Q:** How are third-party automations controlled?  
  **A:** Automation callbacks (e.g., n8n) require scoped service tokens, hashed and constant-time compared. Delivery callbacks are idempotent; retries after success are no-ops.  
  **Evidence:** `lib/auth/serviceToken.ts`; `docs/automation/n8n-skillify-bridge.md`.  
  **Notes:** Tokens can be revoked/rotated immediately in the DB.

## 7) Incident Response

- **Q:** How do you handle unauthorized access attempts?  
  **A:** Routes return 403/404 with no existence leakage; audit logs remain intact. Kill switches (global/workspace) and entitlement checks continue to apply.  
  **Evidence:** Download/artifact concealment rules; `docs/security-pack/entitlement-enforcement-final.md`.  
  **Notes:** Incident runbooks documented separately; alerts are deployment-dependent.

## 8) Customer Transparency

- **Q:** How do customers verify their access without editing it?  
  **A:** Read-only APIs provide entitlement views and audit timelines; history can be exported as CSV. Customers cannot mutate entitlements or audit records.  
  **Evidence:** `GET /api/workspaces/:id/entitlements`; `GET /api/workspaces/:id/entitlements/history?format=csv`; `GET /api/security-pack/request/:id`.  
  **Notes:** Disputes can be resolved using these read-only exports.

## 9) Compliance Alignment (SOC-2)

- **Q:** How do you prevent unauthorized downloads?  
  **A:** Downloads require delivery events plus download entitlements; unauthorized/undelivered access returns 404 to avoid leakage.  
  **Evidence:** Download/artifact route behavior; `docs/security-pack/entitlement-enforcement-final.md`.  
  **Notes:** No URLs stored in audit tables; resolved on demand.

- **Q:** How are controls aligned to SOC-2?  
  **A:** Logical access via entitlements (CC6), audit/change tracking via append-only logs (CC7/CC7.3), automation controls via scoped tokens and idempotent callbacks (CC7.2).  
  **Evidence:** `docs/compliance/security-pack-soc2-narrative.md`; `docs/compliance/security-pack-soc2-evidence-index.md`.  
  **Notes:** No certification guarantees are made; evidence is provided via exports and logs.

# SOC-2 Interview Simulation — Security Pack (Dialogue)

**Participants:** Auditor (A), Skillify Compliance Owner (C), Engineering Lead (E)  
**Scope:** Security Pack only (entitlements, approvals, audit logging, automation, transparency)

---

## 1) Opening Context

**A:** To confirm, today’s scope is the Security Pack only. No broader AI features?  
**C:** Correct. We’re focusing solely on the Security Pack governance stack: entitlements, approvals, audit logging, automation callbacks, and transparency APIs.  
**A:** Noted. No out-of-scope systems?  
**C:** None beyond supporting auth (Clerk) and persistence (Prisma/Postgres); all controls are documented in the Security Pack artifacts.
**Auditor commentary:** Scope is narrow and clearly defined; acceptable for this session.

## 2) Access Control Deep Dive

**A:** How do you gate access? Plans or entitlements?  
**C:** Contract entitlements only. Routes call `hasWorkspaceEntitlement`; there’s no plan-name branching. See `docs/security-pack/entitlement-enforcement-final.md`.  
**A:** Can a customer self-enable?  
**C:** No. Entitlements are mutated only via system token–protected endpoint (`/api/internal/entitlements`) and service tokens scoped to `ENTITLEMENT_ADMIN`. No UI toggles.  
**A:** Reviewer roles?  
**E:** Approval inbox is role-gated (Security/Legal/GRC) server-side and requires the approval-inbox entitlement.  
**Auditor commentary:** Preventive control via entitlements and reviewer roles; no self-service path.

## 3) Approval & Governance

**A:** How are approvals enforced and how is bypass prevented?  
**C:** Approvals append audit events; there are no status columns to edit. Delivery requires the APPROVED/REJECTED events plus entitlement checks.  
**A:** Evidence of separation of duties?  
**E:** Requesters cannot self-approve unless they hold reviewer role and entitlement. Approvals flow through `POST /api/security-pack/request/:id/decision`; append-only audit shows actor/role.  
**Auditor commentary:** Separation of duties enforced; bypass risk mitigated by append-only timeline dependency.

## 4) Audit Logging & Integrity

**A:** How do you ensure audit integrity?  
**C:** `SecurityPackAuditEvent` and `EntitlementAuditEvent` are append-only; no update/delete paths. Timelines are ordered by createdAt. Downloads/links are not stored in audit.  
**A:** Tampering prevention?  
**E:** No payloads in audit tables; unauthorized access to timelines/downloads returns 404/403. Integrity relies on append-only DB plus backups.  
**Auditor commentary:** Integrity is procedural (append-only + DB controls). Acceptable given evidence indexing.

## 5) Automation & Third-Party Risk

**A:** n8n callbacks—how do you control them?  
**E:** Delivery callbacks require `SECURITY_PACK_DELIVERY` service tokens, hashed and constant-time compared. Idempotent: repeat after success is a no-op. See `lib/auth/serviceToken.ts` and delivery route comments.  
**A:** Revocation?  
**C:** Tokens have `active`/`revokedAt`; revocation in DB invalidates immediately. Rotation strategy is reissue then revoke.  
**Auditor commentary:** Scoped tokens with idempotent handling; acceptable third-party risk posture.

## 6) Contract & Entitlement Governance

**A:** How are entitlements granted and tracked?  
**C:** `ContractEntitlement` and `ContractException` tables store effective/expiry. Changes recorded in `EntitlementAuditEvent` (append-only). Resolver reads only current state with time bounds.  
**A:** How do exceptions expire?  
**E:** Resolver excludes records past `expiresAt`; uniqueness on `(workspaceId, entitlementKey, effectiveAt)` prevents duplicates.  
**Auditor commentary:** Contract-driven; expiration enforced in resolver; audit log available.

## 7) Customer Transparency

**A:** What can customers see?  
**C:** Read-only entitlements via `GET /api/workspaces/:id/entitlements`; timeline via `GET /api/security-pack/request/:id`; history CSV via `GET /api/workspaces/:id/entitlements/history?format=csv`.  
**A:** What can they not change?  
**E:** They cannot change entitlements or audit events; routes are read-only and mutation endpoints are system-token only.  
**A:** Dispute handling?  
**C:** Customers can present timeline/history exports; internal review compares against append-only audit.  
**Auditor commentary:** Transparency without mutation; aligns with SOC-2 evidence expectations.

## 8) Closing Questions

**A:** Known limitations?  
**C:** No SLA on event timing (footnote in timeline); alerts on entitlement anomalies are deployment-dependent.  
**A:** Non-guarantees?  
**E:** No promised approvals, no certification guarantees; exports are point-in-time snapshots.  
**A:** Confidence?  
**C:** High on entitlement enforcement, append-only audits, and token scopes; medium where alerting depends on deployment sinks.  
**Auditor commentary:** Controls are deterministic; note medium confidence on alerting coverage.

## Final Summary (Pass / Follow-up / Evidence Requested)

- **Assessment:** Pass with minor follow-ups.
- **Follow-ups:** Provide sample outputs from entitlement history CSV and a timeline response including the delay disclaimer.
- **Evidence requested:** Links to `docs/security-pack/entitlement-enforcement-final.md`, `docs/compliance/security-pack-soc2-evidence-index.md`, and `docs/exec/security-pack-system-overview.md`.

# Enterprise RFP Stress Test — Security Pack

Adversarial simulation using only existing controls and artifacts.

## 1) RFP Context

- Buyer profile: Enterprise (regulated or non-regulated); vendor risk focus on governed evidence delivery.
- Scope: Security evidence delivery, access control, approvals, audit integrity, transparency.
- Intent: Reduce vendor risk without custom commitments.

## 2) RFP Q&A Table

| Category                      | RFP-Style Question                                  | Approved Response (2–5 sentences)                                                                                                                                                                   | Evidence Reference                                   | Confidence | Red Flag if Mis-Answered                       |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- | ---------------------------------------------- |
| Access control & entitlements | Describe how access to Security Pack is controlled. | Access is contract-entitlement based; there is no self-service activation. Every route (request, approval, download, audit feed) enforces entitlements server-side.                                 | Entitlement enforcement doc; Trust Center copy       | High       | Suggesting UI toggles or plan-name shortcuts   |
| Approval workflows            | How are approvals enforced?                         | Approvals/rejections append audit events; there are no editable status fields. Delivery requires APPROVED events plus entitlements; unauthorized attempts return 403/404.                           | Timeline API description; approval inbox doc         | High       | Promising guaranteed approvals                 |
| Audit logging & immutability  | Can audit logs be altered?                          | No. SecurityPackAuditEvent and EntitlementAuditEvent are append-only; no update/delete paths. Timelines are ordered and read-only.                                                                  | SOC-2 narrative; evidence index                      | High       | Implying edit/delete is possible               |
| Data handling & retention     | Do audit records store payloads or URLs?            | No. Audit tables store metadata only; evidence URLs are generated on demand and not stored. Exports are point-in-time snapshots.                                                                    | Evidence index; Trust Center copy                    | High       | Claiming payload storage or permanent URLs     |
| Third-party integrations      | How are automation callbacks secured?               | Automation uses scoped service tokens (hashed, constant-time compared). Callbacks are idempotent; retries after success are no-ops; tokens can be revoked/rotated.                                  | Service token auth doc; n8n bridge doc               | High       | Offering unscoped tokens or custom automations |
| Incident response             | What happens on unauthorized access attempts?       | Unauthorized/undelivered download attempts return 404/403 and do not reveal existence; audit records remain intact. Kill switches and entitlements continue to gate access.                         | Trust Center copy; entitlement enforcement doc       | Medium     | Promising SLAs or unimplemented alerting       |
| Customer transparency         | How can customers verify access/history?            | Read-only entitlement status/history and request timelines provide visibility; customers cannot mutate these records. Exports (CSV/timeline) are available on request.                              | Trust Center copy; compliance packet                 | High       | Offering editable access or custom exports     |
| Compliance alignment (SOC-2)  | How does this align with SOC-2?                     | Logical access via entitlements (CC6), append-only audit/change tracking (CC7/CC7.3), scoped automation controls and idempotency (CC7.2). No certification promises; evidence available on request. | SOC-2 narrative; evidence index; readiness scorecard | High       | Promising certification or timelines           |

## 3) RFP Outcome Assessment

- Strongest answers: access control, audit immutability, data handling, automation controls.
- Potential pushback: incident response/alerting (clarify no SLA; controls are entitlement + kill-switch based).
- Do not negotiate: self-service activation, guaranteed approvals, certification promises, SLAs/timelines.

## 4) Sales Guidance

- Escalate vs hold: escalate only if buyer requests changes to entitlements/approvals; hold the line on no self-service, no guarantees.
- Reframe: emphasize contract-entitlement enforcement and append-only audits to address risk without custom builds.
- Legal-safe language: avoid “enable anytime,” “guarantee,” “certified”; stick to documented controls and evidence references.

## 5) Sales Readiness Verdict

- Verdict: **RFP-ready**, with a standard clarification that incident response is governed by entitlement/kill-switch controls and no SLAs are offered. No custom commitments required.

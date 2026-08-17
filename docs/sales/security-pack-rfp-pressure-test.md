# Security Pack RFP Pressure Test (Enterprise Simulation)

Adversarial RFP using Trust Center + final questionnaire only. No new claims or custom commitments.

## Mock RFP (Question Set)

1. Governance & Access Control
2. Approval Workflows
3. Audit Logging & Immutability
4. Evidence Handling & Retention
5. Third-Party Risk
6. Exception & Expiration Handling
7. Incident Response
8. Customer Transparency
9. Compliance Alignment (SOC-2)

## Filled Responses (Trust Center + Questionnaire)

| Category                        | RFP Question                                          | Approved Response (2–5 sentences)                                                                                                                                                                                                                                                               | Artifact Reference                                                                    | Strength                                                 |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Governance & Access Control     | Describe how customers verify controls independently. | Customers can view read-only entitlements and timelines of requests/approvals/deliveries; these are immutable. Exports (e.g., history CSV, timelines) are available on demand after delivery is recorded. Access is enforced server-side via contract entitlements; no self-service activation. | Trust Center Overview/Access/Transparency; Procurement Questionnaire (Access Control) | Strong                                                   |
| Governance & Access Control     | Explain how access is revoked at contract end.        | Entitlements follow contract terms/expirations; when expired, the resolver stops granting access. History remains in append-only entitlement audit logs; downloads require active entitlements plus delivery events, so they remain unavailable after expiry.                                   | Trust Center Access; Questionnaire (Entitlements)                                     | Strong                                                   |
| Approval Workflows              | How are approvals enforced and recorded?              | Approvals/rejections are append-only audit events; there are no editable status fields. Delivery requires APPROVED events plus entitlements; unauthorized or undelivered attempts return “not found/forbidden.”                                                                                 | Trust Center Approvals; Questionnaire (Approvals)                                     | Strong                                                   |
| Audit Logging & Immutability    | Can audit logs be altered or deleted?                 | No. Audit logs are append-only; entries are not edited or deleted. Timelines are ordered and read-only.                                                                                                                                                                                         | Trust Center Audit Logging; Questionnaire (Audit Integrity)                           | Strong                                                   |
| Evidence Handling & Retention   | Do you store evidence payloads or URLs?               | No. Audit records store metadata only; evidence URLs are generated on demand and not persisted. Exports are point-in-time snapshots.                                                                                                                                                            | Trust Center Data Handling; Questionnaire (Data Handling)                             | Strong                                                   |
| Third-Party Risk                | How are automation callbacks secured?                 | Automation uses scoped service tokens validated server-side; tokens are hashed and revocable. Deliveries are idempotent—retries after success have no effect.                                                                                                                                   | Trust Center Automation; Questionnaire (Automation)                                   | Strong                                                   |
| Exception & Expiration Handling | How do you manage exceptions and expirations?         | Exceptions are time-bound entitlements with effective/expiry; expired entries are excluded automatically by the resolver. All changes are recorded in append-only entitlement history.                                                                                                          | Trust Center Access/Explicit Non-Guarantees; Questionnaire (Entitlements)             | Strong                                                   |
| Incident Response               | What happens on unauthorized access attempts?         | Unauthorized/undelivered download attempts return “not found/forbidden” and do not reveal existence. Entitlements and kill-switch controls continue to gate access; audit records remain intact.                                                                                                | Trust Center Download Controls/Non-Guarantees; Questionnaire (Access Control)         | Weak but acceptable (needs kill-switch mention if asked) |
| Customer Transparency           | How can customers verify access and history?          | Read-only entitlement status/history and request timelines provide visibility; customers cannot modify them. Exports (CSV/timeline) are available on request after delivery.                                                                                                                    | Trust Center Transparency; Questionnaire (Transparency)                               | Strong                                                   |
| Compliance Alignment (SOC-2)    | How does this align with SOC-2?                       | Logical access is enforced via entitlements (CC6); audit/change tracking is append-only (CC7/CC7.3); automation is scoped and idempotent (CC7.2). No certification is promised; evidence is available on request.                                                                               | Trust Center Non-Guarantees; Questionnaire (Compliance Alignment)                     | Strong                                                   |

## Gap Analysis

| Area                       | Status              | Notes                                                                          |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| Incident response language | Needs clarification | Explicitly mention kill-switch controls and no SLAs when asked.                |
| All other areas            | Ready               | Responses covered by Trust Center + questionnaire with deterministic language. |

## Outcome

- **Verdict:** Ready, with a standard clarification on incident response (kill-switch mention, no SLAs).
- **Do not answer beyond:** No SLAs, no guarantees, no self-service toggles, no custom exports or certifications.

# Security Pack SOC-2 Readiness Scorecard

Evidence-backed internal scorecard. No hypothetical controls.

## Executive Summary

- Audit confidence: **High** for entitlement enforcement, append-only audits, token scoping, and transparency exports; **Medium** where alerting is deployment-specific.

## Scorecard

| Section               | Control Description                                                               | Evidence                                                              | Status  | Notes                                                |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| Access Control        | Entitlements enforced on all Security Pack routes (request, download, audit feed) | `docs/security-pack/entitlement-enforcement-final.md`; route handlers | Pass    | Contract entitlements only; no plan branching        |
| Access Control        | Role separation for approvals (reviewer-only)                                     | Approval inbox doc; decision API                                      | Pass    | Requesters cannot self-approve unless also reviewers |
| Change Management     | Entitlement changes logged (append-only)                                          | `docs/enterprise/entitlement-audit-log.md`; history API               | Pass    | EntitlementAuditEvent is append-only                 |
| Change Management     | Exception expiry enforced in resolver                                             | `lib/enterprise/entitlements.ts`; ContractException schema            | Pass    | Expired exceptions excluded automatically            |
| Audit Integrity       | Append-only SecurityPackAuditEvent / EntitlementAuditEvent                        | Audit schemas; SOC-2 narrative                                        | Pass    | No update/delete paths                               |
| Audit Integrity       | Timeline ordering and immutability                                                | `GET /api/security-pack/request/:id`; evidence index                  | Pass    | Ordered by createdAt; read-only                      |
| Automation Risk       | Scoped service tokens for callbacks                                               | `lib/auth/serviceToken.ts`; prisma scopes                             | Pass    | SECURITY_PACK_DELIVERY, ENTITLEMENT_ADMIN scoped     |
| Automation Risk       | Idempotent delivery callbacks                                                     | Delivery route comments; n8n bridge doc                               | Pass    | Repeat after success is a no-op                      |
| Automation Risk       | Token revocation/rotation                                                         | AutomationServiceToken schema; auth helper                            | Pass    | active/revokedAt enforced                            |
| Customer Transparency | Read-only entitlement view/history                                                | Entitlement APIs; Trust Center copy                                   | Pass    | No mutation endpoints                                |
| Customer Transparency | Export availability (timelines/history CSV)                                       | Entitlement history CSV; timeline API                                 | Pass    | Read-only exports                                    |
| Operational Maturity  | Alerting (optional)                                                               | Alerting doc; metrics/alerts                                          | Partial | Deployment-specific sinks                            |
| Operational Maturity  | Incident readiness (kill switches, revocation)                                    | Kill-switch enforcement; token revocation                             | Pass    | Global/workspace kill switches + token controls      |
| Operational Maturity  | Backup posture (DB)                                                               | DB backups (operational)                                              | Partial | Depends on deployment backup configuration           |

## Audit Confidence

- Overall: **High**, with caveat that alerting and backup posture depend on deployment configuration. Address these partials before formal audit.

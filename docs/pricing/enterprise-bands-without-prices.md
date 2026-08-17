# Enterprise Pricing Bands (No Prices) — Security Pack Alignment

Bands are contract constructs; entitlements (not UI toggles) define access. No pricing, discounts, or seat counts are included.

## Band → Entitlement Matrix

| Band                 | Included Entitlements                                                                                                  | Optional Add-ons                                    | Approval Model                                                         | Audit Visibility                                                   | Regulatory Suitability                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| Core Enterprise      | SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD                                                                          | WORKSPACE_AUDIT_FEED, SERVICE_TOKEN_AUTOMATION      | Approvals required (Security/Legal/GRC)                                | Timeline via request API; audit feed optional                      | Suitable for standard enterprise             |
| Enterprise Plus      | SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD, WORKSPACE_AUDIT_FEED, SERVICE_TOKEN_AUTOMATION                          | SECURITY_PACK_APPROVAL_INBOX, CUSTOM_APPROVAL_ROLES | Approvals required; internal reviewer inbox available if included      | Timeline + audit feed; delivery callbacks logged                   | Suitable for higher assurance buyers         |
| Regulated Enterprise | All Security Pack entitlements (request, download, audit feed, approval inbox, service token automation, custom roles) | Exceptions by amendment only                        | Approvals required with reviewer roles; custom approval roles expected | Full timeline + audit feed; delivery and approval events auditable | Suitable for regulated/critical environments |

## Notes for Sales/Legal Alignment

- Bands are expressed in contracts as entitlement bundles; no pricing language is present here.
- Optional add-ons are granted via amendment; exceptions must be time-bound and logged.
- Approvals are always enforced server-side; approval inbox/custom roles are entitlements, not UI-only features.
- Regulatory suitability indicates intended fit, not a certification claim.

## Contract Language Guidance (conceptual)

- State entitlements explicitly (e.g., “Workspace is granted SECURITY_PACK_DOWNLOAD and WORKSPACE_AUDIT_FEED entitlements for the term…”).
- Optional add-ons: “Additional entitlements (e.g., SECURITY_PACK_APPROVAL_INBOX) may be added via mutual amendment.”
- Exceptions: “Temporary exceptions are time-bound and expire automatically; no self-service enablement.”

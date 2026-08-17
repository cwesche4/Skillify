# Sales-to-Contract Entitlement Mapping — Security Pack

Contract language is the only source of truth. No manual toggles or post-sign ambiguity.

## Default Enterprise Bundle (contract clause → entitlements)

- Clause: “Security Pack entitlements are included for the workspace(s) under this agreement.”  
  Grants: SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD, WORKSPACE_AUDIT_FEED, SERVICE_TOKEN_AUTOMATION.

## Optional Additions (if explicitly included)

- Clause: “Approval inbox entitlements are included.” → SECURITY_PACK_APPROVAL_INBOX.
- Clause: “Custom approval roles are included.” → CUSTOM_APPROVAL_ROLES.
- Clause: “Temporary access to [ENTITLEMENT_KEY] from [EFFECTIVE] to [EXPIRY].” → Time-bound ContractException for that key.

## Exceptions (time-bound only)

- Exceptions must specify entitlement key, effective date, and expiry date.
- No open-ended exceptions; no UI toggles; no plan-name branching.

## Sales Checklist

- Confirm contract clause explicitly lists included entitlements (default bundle if Enterprise).
- Capture any optional additions with explicit entitlement keys and dates.
- Do not promise SLAs, certifications, or self-service activation.
- Do not imply SKU-based or toggle-based access; entitlements are contract-granted only.

## Legal Review Guardrails

- Ensure clauses specify entitlement keys and term (effective/expiry for exceptions).
- Reject ambiguous language (“enable access on request,” “toggle on/off”).
- Align non-guarantees: no SLAs, no certification promises, no self-service.
- Verify exceptions are time-bound and auditable (ContractException).

# Enterprise Entitlement Control Plane — Security Pack

Canonical, contract-driven model with append-only audit expectations. No plan-name branching or UI toggles.

## Scopes

- SECURITY_PACK
- EXPORTS
- APPROVALS
- ARTIFACT_DOWNLOAD

## Resolver Guarantees

- Contract is the single source (ContractEntitlement + ContractException).
- Time-bound enforcement: effective/expiry respected for all scopes.
- Read-only resolver; no mutations; append-only audit handled elsewhere.
- No SKU or plan-based fallbacks; no self-service grants.

## Exceptions

- Represented as ContractException with explicit effective/expiry.
- Included in resolver evaluation; excluded automatically when expired.

## Audit Expectations

- All entitlement mutations (grants, revokes, expirations) are recorded in EntitlementAuditEvent (append-only).
- Resolver is read-only; does not write to audit logs directly.
- Inspection APIs/readers expose current and historical states without mutation.

## Enforcement Notes

- Engineering: enforce entitlements via resolver output only; do not branch on plan names; respect scope list.
- Sales/Legal: entitlements must be contract-specified; no SKU toggles or UI switches; exceptions must be time-bound.
- Compliance: lifecycle approvals required for copy/claim changes; resolver remains the canonical check.

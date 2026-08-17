# Security Pack Contract Packaging (Enterprise)

## Positioning

- Security Pack is an Enterprise contract module governed by entitlements, not a standalone SKU and not self-service.
- Activation is tied to contract terms; backend entitlements (not plan labels) control access.

## Entitlement Packaging Scenarios

- **Default Enterprise inclusion:** Enterprise contracts include Security Pack entitlements (request, download, audit feed, approval inbox, service token automation) unless explicitly excluded.
- **Contract amendment:** Entitlements can be added or removed via signed amendment; changes are reflected in the entitlement resolver (no SKU changes).
- **Temporary exception:** Short-term entitlements may be granted for a defined period (expiresAt). Exceptions must be logged with source = exception and have an explicit end date.
- **Regulated customer variants:** Additional entitlements (e.g., approval inbox, custom approval roles) may be included based on regulated terms; governed by amendment/exception, not UI toggles.

## Sales + Legal Boundaries

- **Grant authority:** Only contract/billing operations can grant or revoke entitlements via contract/amendment/exception records; sales cannot toggle in-product.
- **Logging:** All entitlement grants/changes are recorded with source (contract, amendment, exception), grantedAt, and expiresAt when applicable.
- **Expiration enforcement:** Backend entitlement resolver honors expiresAt; expired exceptions are not served to APIs. No UI control can override expiration.
- **No self-service:** Customers cannot enable/disable Security Pack; requests are routed through contract changes only.

## Audit Expectations

- **Auditor visibility:** Auditors should see entitlement-based enforcement in APIs (403/404 on missing entitlements), append-only audit events for Security Pack actions, and evidence of contract-sourced entitlements (resolver mapping).
- **Out of scope:** No pricing, no SKU switches, no UI toggles for entitlements; entitlements are not managed by customers or frontline sales.
- **Evidence artifacts:** Refer auditors to entitlement enforcement summary (`docs/security-pack/entitlement-enforcement-final.md`) and SOC 2 evidence index for control verification paths.

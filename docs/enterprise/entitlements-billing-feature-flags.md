# Entitlements → Billing → Feature Flags

Backend is the source of truth; UI only mirrors read-only data from APIs. No plan-name branching in UI or routes.

## Architecture (text)

- **Billing contracts** (plan, amendments, exceptions) resolve to a set of entitlement keys.
- **Entitlement resolver (backend-only)** maps contract → entitlements and is used by all Security Pack routes.
- **Entitlements API (read-only)** exposes resolved entitlements per workspace to the UI for display/feature-flag reflection.
- **Feature flags (UI)** are informational; they cannot bypass backend checks. UI hides/disables based on API responses, not plan names.

## Billing Contract Representation

- Source: billing system returns a normalized contract object per workspace:
  - `workspaceId`
  - `plan`: string (e.g., enterprise)
  - `amendments`: optional list of added/removed entitlements
  - `effectiveAt`, `expiresAt`
- Contract data is consumed only by the entitlement resolver; routes never inspect plan names directly.

## Contract → Entitlements Mapping

- Single mapping table in backend (see `lib/enterprise/entitlements.ts`):
  - Plan → entitlement set
  - Amendments can add/remove keys
- Resolver: `getWorkspaceEntitlements(workspaceId)` returns `Set<EntitlementKey>`
- Helper: `hasWorkspaceEntitlement(workspaceId, key)` used inside APIs (request, download, approval inbox, audit feed).

## Read-Only Entitlements Endpoint (UI consumption)

- Route: `GET /api/workspaces/:id/entitlements`
- Auth: workspace member; admin-only for full list
- Returns:
  ```json
  {
    "workspaceId": "...",
    "entitlements": ["SECURITY_PACK_REQUEST", "SECURITY_PACK_DOWNLOAD", ...],
    "fetchedAt": "ISO"
  }
  ```
- No mutations; no plan names; no billing data leakage.

## Feature Flag Consumption Rules (UI)

- UI reads entitlements from the read-only endpoint and sets local feature flags (display-only).
- UI must never gate actions solely on these flags; all actions call APIs that enforce entitlements server-side.
- If entitlements are missing, UI shows neutral, factual messaging (e.g., “Enterprise entitlement required for Security Pack downloads”).
- No plan-name branching; UI never assumes entitlements based on plan labels.

## Enforcement Guarantees

- APIs perform authoritative checks via `hasWorkspaceEntitlement`.
- Denials are logged; UI state is non-authoritative and cannot grant access.
- Download/artifact/timeline routes still enforce workspace membership and delivery state in addition to entitlements.

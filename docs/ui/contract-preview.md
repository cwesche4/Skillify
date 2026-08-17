# Contract Preview UI (Read-Only)

Route: `/settings/contract` (enterprise customers; read-only).

## Component Structure (no styling)

- `ContractPreviewPage`
  - `EntitlementsSummary`
    - Lists active entitlements (keys, descriptions)
    - Shows effectiveAt, expiresAt (if present), source (contract/amendment/exception)
  - `ContractNotes`
    - Neutral text about contract-driven access and where to request changes (outside product)
  - `EmptyState` / `ErrorState`

## Data Contract

- API response (read-only, backend-sourced):
  ```json
  {
    "entitlements": [
      {
        "key": "SECURITY_PACK_REQUEST",
        "description": "Submit Security Pack requests",
        "effectiveAt": "ISO",
        "expiresAt": "ISO|null",
        "source": "CONTRACT|AMENDMENT|EXCEPTION"
      }
    ],
    "fetchedAt": "ISO"
  }
  ```
- No plan labels, pricing, or billing terms included.

## UX Copy

- Header: “Contract Entitlements”
- Body note: “Access is determined by your contract entitlements. To request changes, contact your account team.”
- Empty state: “No active entitlements found for this workspace.”
- Expired entitlements: “Expired” label with date; no removal from history if shown.

## Permission Rules

- Authenticated workspace members may view; admins see full list. Non-members cannot access (401/403).
- UI is read-only; no edit controls or toggles.
- All data comes from backend entitlements endpoint; no client-side inference or plan labels.

# Entitlement Change History (Read-Only)

Workspace-scoped, append-only view of entitlement changes for transparency. No PII, pricing, or internal notes are exposed.

## API Contract (read-only)

- Route: `GET /api/workspaces/:id/entitlements/history`
- Response:
  ```json
  {
    "workspaceId": "...",
    "items": [
      {
        "entitlementKey": "SECURITY_PACK_REQUEST",
        "action": "GRANTED|REVOKED|EXPIRED",
        "source": "CONTRACT|AMENDMENT|EXCEPTION|RENEWAL",
        "effectiveAt": "ISO",
        "createdAt": "ISO"
      }
    ]
  }
  ```
- No actor PII, no internal notes, no pricing data.

## UI Wiring

- Component: `EntitlementHistory`
  - Fetches the above endpoint on load.
  - Renders table/list with columns: Entitlement, Action, Effective date, Source, Recorded at.
  - States: loading, empty (“No entitlement changes recorded.”), error (neutral banner).
- No edit controls; purely read-only.

## Visibility Rules

- Authenticated workspace members; admins can view full history. Non-members receive 401/403.
- Data is append-only from `EntitlementAuditEvent`; no client-side sorting beyond what API returns (default: newest first or as provided).
- No actor identities or internal notes displayed; only the fields listed above.

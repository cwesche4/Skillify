# Security Pack Entitlement Enforcement (Final)

Backend uses contract entitlements exclusively; no plan-name checks or UI-only gating. All routes verify workspace scope and membership first.

## Routes and Required Entitlements

- `POST /api/security-pack/request` → `SECURITY_PACK_REQUEST`
- `GET /api/security-pack/request/:id` → `SECURITY_PACK_REQUEST` (requester or workspace admin)
- `GET /api/security-pack/request/:id/download` → `SECURITY_PACK_DOWNLOAD` (requester or workspace admin; 404 on deny per concealment)
- `GET /api/security-pack/request/:id/artifact` → `SECURITY_PACK_DOWNLOAD` (requester or workspace admin; 404 on deny per concealment)
- `GET /api/security-pack/audit` → `WORKSPACE_AUDIT_FEED` (workspace admin)
- `GET /api/internal/security-pack/approvals` → `SECURITY_PACK_APPROVAL_INBOX` (Security/Legal/GRC reviewers)

## Enforcement Snippet (pattern)

```ts
const allowed = await hasWorkspaceEntitlement(
  workspaceId,
  'SECURITY_PACK_REQUEST',
)
if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

Download/artifact endpoints return 404 on entitlement failure to avoid existence leakage; others return 403 after membership checks.

## UI Consumption

- UI must not branch on plan names; it should render based on API responses (entitlements and HTTP status).
- Feature flags are informational only; backend entitlements are authoritative for access.

## Confirmation

- All listed routes now rely solely on `hasWorkspaceEntitlement` for contract-based gating; no plan-name branching remains in these endpoints.

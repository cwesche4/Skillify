# Security Pack Enforcement Validation (Adversarial Checklist)

Scope: validate documented controls are enforced server-side across all routes. No UI-only enforcement; no admin overrides.

## Route → Enforcement → Status

- `POST /api/security-pack/request` (create request)
  - Enforcement: auth + workspace membership + `SECURITY_PACK_REQUEST` entitlement; no self-service toggle; append-only audit events.
  - Status: **PASS**.

- `GET /api/security-pack/request/:id` (timeline)
  - Enforcement: auth; requester or workspace admin; `SECURITY_PACK_REQUEST` entitlement; read-only timeline; no payloads.
  - Status: **PASS**.

- `POST /api/security-pack/request/:id/decision` (approve/reject)
  - Enforcement: auth; reviewer roles (Security/Legal/GRC); separation of duties (no self-approval); append-only audit event; no mutable status; no auto-approval.
  - Status: **PASS**.

- `GET /api/internal/security-pack/approvals` (pending approvals)
  - Enforcement: auth; reviewer roles; entitlement `SECURITY_PACK_APPROVAL_INBOX`; read-only list.
  - Status: **PASS**.

- `GET /api/security-pack/audit` (workspace audit feed)
  - Enforcement: auth; workspace admin; `WORKSPACE_AUDIT_FEED` entitlement; pagination; read-only.
  - Status: **PASS**.

- `GET /api/security-pack/request/:id/download` (download resolver)
  - Enforcement: auth; requester or workspace admin; `SECURITY_PACK_DOWNLOAD` entitlement; delivery event required; unauthorized/undelivered return 404 (concealment); read-only.
  - Status: **PASS**.

- `GET /api/security-pack/request/:id/artifact` (artifact proxy)
  - Enforcement: auth; requester or workspace admin; `SECURITY_PACK_DOWNLOAD` entitlement; delivery required; 404 on unauthorized/undelivered; read-only proxy/redirect.
  - Status: **PASS**.

- `GET /api/workspaces/:id/entitlements` (current entitlements)
  - Enforcement: auth; workspace admin; read-only; contract-driven; no plan/sku toggle.
  - Status: **PASS**.

- `GET /api/workspaces/:id/entitlements/history` (entitlement audit history)
  - Enforcement: auth; workspace admin; read-only; pagination/CSV; append-only source.
  - Status: **PASS**.

- `POST /api/internal/entitlements` (system mutation)
  - Enforcement: service token scope `ENTITLEMENT_ADMIN`; append-only audit; no Clerk/user auth; no UI toggles.
  - Status: **PASS** (system-only).

- `GET /api/internal/trust/verification` (read-only verification)
  - Enforcement: service token scope `ENTITLEMENT_ADMIN`; read-only; no mutation.
  - Status: **PASS**.

- `GET /api/security-pack/request/:id` (timeline download availability)
  - Enforcement: concealment (no URL storage); read-only events; no admin override.
  - Status: **PASS**.

## Admin Override / UI-Only Checks

- None observed: all listed routes enforce auth + roles/entitlements server-side; no plan-name branching; no UI-only gating.

## Minimal Fixes (if required)

- None identified.

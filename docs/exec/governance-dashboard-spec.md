# Executive Governance Dashboard (Read-Only) — Security Pack

Read-only visibility for founders/execs. No mutations; no operational dependency on the dashboard.

## Metrics (Definitions)

- **Active Enterprise entitlements:** Count of workspaces with active SECURITY_PACK-related entitlements (resolver output). Source: entitlement resolver + ContractEntitlement/Exception.
- **Outstanding approvals:** Count of Security Pack requests requiring approval (no APPROVED/REJECTED events) per workspace. Source: SecurityPackRequest + SecurityPackAuditEvent.
- **Expiring exceptions:** List/count of ContractException entries expiring within N days. Source: ContractException.
- **Audit readiness score (readiness flag):** Derived from readiness scorecard status (e.g., High/Medium based on documented partials). Source: readiness scorecard doc status flag (no DB).

## Dashboard Spec (Read-Only)

- Views:
  - Summary cards for each metric.
  - Table of expiring exceptions with workspaceId, entitlementKey, expiresAt.
  - Table of outstanding approvals with workspaceId, requestId, submittedAt.
- Filters: workspaceId (optional).
- No write actions; links to canonical docs (Trust Center, entitlement model, readiness scorecard).

## Read-Only API Layer (Conceptual)

- `GET /api/internal/exec/entitlements/summary` → { activeCount, byScope }
- `GET /api/internal/exec/approvals/outstanding` → list of pending requests (ids, workspaceId, submittedAt)
- `GET /api/internal/exec/exceptions/expiring?days=N` → list/count of exceptions expiring within N days
- All endpoints: service token auth; read-only queries; no mutations.

## Guardrails

- No mutation endpoints; dashboard consumes read-only APIs.
- No SLA or operational dependency on the dashboard; underlying controls continue without it.
- Data sources align with contract-entitlement resolver and append-only audit events; no plan-name logic.

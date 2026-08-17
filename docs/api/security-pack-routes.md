# Security Pack API Routes (Next.js App Router)

Assumptions: Next.js App Router (`/app/api`), Prisma ORM, Clerk auth, workspace membership enforced. Append-only audit logging; workspace-scoped; Enterprise plan required for privileged actions.

## Routes

### 1) Create Security Pack Request

- **POST** `/api/security-pack/request`
- **Auth:** Authenticated user; must be workspace member; plan check (Enterprise).
- **Body:** `{ workspaceId, industry, reviewType, requestedArtifacts: string[], ndaConfirmed: boolean }`
- **Responsibilities:**
  - Validate user and workspace membership.
  - Enforce plan gating.
  - Create SecurityPackRequest record.
  - Append initial SecurityPackAuditEvent (append-only).
- **Audit:** Append create event with requester, workspaceId, requested artifacts, nda flag.

### 2) Get Request Status

- **GET** `/api/security-pack/request/:id`
- **Auth:** Requester or workspace admin.
- **Response:** Status + metadata only; no internal routing.
- **Audit:** None (read-only).

### 3) Approve / Reject Request (Internal)

- **POST** `/api/security-pack/request/:id/decision`
- **Auth:** Security/Legal role (internal guard).
- **Body:** `{ decision: "APPROVED"|"REJECTED", role: "SECURITY"|"LEGAL", notes?: string }`
- **Responsibilities:**
  - Enforce internal role.
  - Append approval audit event (append-only).
  - Update request state (request record), preserving audit chain.
- **Audit:** Append approval/decision event with role, notes, timestamp.

### 4) Mark Delivered (Automation Callback)

- **POST** `/api/security-pack/request/:id/delivered`
- **Auth:** Internal automation (n8n/Skillify) with service credential.
- **Body:** Delivery metadata only (no payloads), e.g., `{ deliveryMethod, automationSystem, deliveredAt }`
- **Responsibilities:**
  - Append delivery audit event; store delivery metadata.
  - Do not store payload contents.
- **Audit:** Append delivery event with method/system/timestamp.

### 5) List Audit Log (Read-Only)

- **GET** `/api/security-pack/audit?workspaceId=...`
- **Auth:** Workspace admin.
- **Responsibilities:**
  - Return ordered audit entries for the workspace.
  - Read-only; auditor-friendly output; no mutations.
- **Audit:** None (read-only).

## Authorization & Validation Summary

- Workspace membership required for create/status.
- Workspace admin for audit listing.
- Security/Legal roles for decision route.
- Service credential for delivery callback.
- Plan gating (Enterprise) on create route for privileged evidence requests.
- NDA flag respected; no delivery without approvals.

## Audit Logging Guarantees

- Append-only `SecurityPackAuditEvent` per action (create, decision, delivery).
- No payload contents stored; metadata only.
- Workspace-scoped entries; indexed by createdAt.

_Footnote: Events are generated automatically and may be delayed during approval or delivery._

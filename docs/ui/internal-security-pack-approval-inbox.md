# Internal Security Pack Approval Inbox (UI Wiring)

Route: `/internal/approvals/security-pack` (internal reviewers only; no customer access).

## Components (structure, no styling)

- `ApprovalInboxPage`
  - `ApprovalInboxList`
    - Fetches pending items via `GET /api/internal/security-pack/approvals?limit=25&cursor=...`
    - Displays: Request ID, Workspace name, Industry, Requested artifacts, NDA status, Submitted at
    - Pagination: uses `nextCursor` returned by API; oldest-first ordering (createdAt, id)
    - States: loading skeleton, empty (“No requests awaiting review”), forbidden banner (403), error banner
  - `ApprovalDetailPanel`
    - Header: Workspace name/ID, Industry, Requested artifacts, NDA status, Submitted timestamp
    - Timeline: `ApprovalTimeline` rendering labels + timestamps only from `GET /api/security-pack/request/:id`
    - Actions: `ApprovalActions` with Approve / Reject buttons and optional short note input

## Data Flow

1. On load, list component calls approvals API; populates list, sets `nextCursor` for pagination; selects first item if available.
2. Selecting a row triggers detail fetch:
   - `GET /api/security-pack/request/:id` → returns request metadata, ordered timeline, footnote.
3. Actions:
   - Approve/Reject buttons call `POST /api/security-pack/request/:id/decision` with `{ decision: 'APPROVED' | 'REJECTED', role, notes? }`.
   - While request in-flight, disable buttons and note input.
   - On success: refetch list (respecting pagination) and clear selection if item disappears; refetch detail if still present.
4. NDA status shown from list payload; timeline stays read-only (no role/system/correlation IDs shown).

## UI → API Mapping

- List: `GET /api/internal/security-pack/approvals?limit=25&cursor=...` (entitlement SECURITY_PACK_APPROVAL_INBOX enforced server-side).
- Detail/Timeline: `GET /api/security-pack/request/:id` (requester/admin timeline; internal reviewers read-only).
- Decision: `POST /api/security-pack/request/:id/decision` (backend appends audit event; UI does not mutate local list except after refetch).

## State Handling Rules

- Loading: show skeletons in list and detail.
- Empty: show “No requests awaiting review.”
- Forbidden (403): show neutral banner; no list items rendered.
- Error (non-403): show neutral error banner; allow retry.
- After decision: remove item by refetching list; if selection is gone, show empty/next item.
- No optimistic updates; source of truth is API responses.

## Visibility & Constraints

- Reviewer roles only (Security/Legal/GRC) — enforced by API; UI assumes denial on 403.
- No payload visibility; no automation system details; no correlation IDs surfaced.
- All dates displayed in ISO or localized format; timeline ordering matches API order.

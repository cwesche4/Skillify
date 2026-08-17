# Security Pack Approval Inbox (Internal UX)

Internal-only inbox for Security/Legal/GRC reviewers. No customer exposure; no direct audit mutation from UI.

## Component Hierarchy (no code)

- `ApprovalInboxPage`
  - `InboxList` (pending items)
    - Rows: Request ID, Workspace name, Industry, Requested artifacts, NDA status (confirmed/missing), Submitted at
  - `RequestDetailPanel`
    - Metadata: Workspace ID, Industry, Review type, Requested artifacts
    - Audit timeline (labels + timestamps only; no internal/system details)
    - Actions: Approve, Reject, Notes input
  - `StateMessages`
    - Empty: “No requests awaiting review”
    - Loading, Error (403/500)

## Data Flow (text)

1. Inbox fetches pending approvals from `GET /api/internal/security-pack/approvals?limit=25&cursor=...` (Security/Legal/GRC scoped, entitlement enforced).
2. Selecting a request loads detail + audit timeline via `GET /api/security-pack/request/:id` (read-only).
3. Approve/Reject triggers `POST /api/security-pack/request/:id/decision` with `{ decision, role, notes? }`; backend appends APPROVED/REJECTED event.
4. UI refreshes list (using returned `nextCursor` for pagination) to remove processed items.

## API Interactions

- **List pending:** `GET /api/internal/security-pack/approvals?limit=25&cursor=createdAt|requestId` (deterministic oldest-first, entitlement SECURITY_PACK_APPROVAL_INBOX required).
- **Detail:** `GET /api/security-pack/request/:id` to show metadata and timeline (footnote included).
- **Decision:** `POST /api/security-pack/request/:id/decision` with `{ decision, role, notes? }`; backend appends APPROVED/REJECTED event. UI does not mutate request directly.

## Visibility & Permissions

- Roles allowed: Security, Legal, GRC (internal). Workspace admins do not see inbox unless granted reviewer role.
- No payload data, no automation/correlation IDs shown.
- NDA status shown only as confirmed/missing from existing audit notes; no sensitive details.

## Ordering & States

- Inbox list sorted oldest first (createdAt ASC, id ASC). Cursor = `createdAt|requestId`.
- Empty state text: “No requests awaiting review.”
- Error handling: 403 (not authorized), 500 (server error) with neutral messaging; forbidden users see read-only banner instead of data.

## Notes

- All decisions flow through API; UI never edits SecurityPackRequest directly.
- Timeline renders labels/timestamps only; no internal routing, roles, or system data exposed.

# Trust Center Runtime Verification — Security Pack

Read-only verification for internal teams and auditors. No new claims; no mutations.

## Control Assertion Checklist (Claim → Enforcement)

- **Access control:** Contract entitlements only; enforced server-side. Verify via entitlement resolver output for a workspace.
- **Approvals:** Append-only approval/rejection events; no mutable status. Verify via SecurityPackAuditEvent for the request.
- **Audit integrity:** Audit tables are append-only; no updates/deletes. Verify reachability only (no mutation).
- **Downloads:** Require entitlement + delivery event; unauthorized returns 404/403. Confirm delivery events exist in audit log.
- **Automation:** Scoped service tokens; idempotent delivery callbacks; tokens revocable.
- **Non-guarantees:** No SLAs, no certification promises, no self-service toggles; verify language matches Trust Center.

## Internal Verification API (Read-Only)

- `GET /api/internal/trust/verification?workspaceId=...`
- Auth: service token scope `ENTITLEMENT_ADMIN`.
- Returns: audit table reachability and (if workspaceId provided) entitlement resolver output. No mutations.
- Purpose: validate claims against live data (entitlement scopes, audit log availability) without exposing internals publicly.

## SOC-2 Walkthrough Script (Verification)

1. Show Trust Center sections (access, approvals, audit integrity, data handling, non-guarantees).
2. Run verification API (with workspaceId) to show entitlements resolved from contract records.
3. Query recent SecurityPackAuditEvent entries for approval/delivery events (read-only) to demonstrate append-only history.
4. Confirm no stored URLs/payloads by showing audit schema fields (metadata only).
5. Reiterate non-guarantees (no SLAs/certifications) and concealment (404/403 for unauthorized/undelivered).

## Notes

- No public exposure of the verification API; internal use only.
- All checks are read-only; no audit mutations are performed.

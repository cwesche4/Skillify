# Security Pack Enterprise Gating (Authoritative)

Backend is the source of truth; all UI gating must reflect backend checks. Denied attempts are logged.

## Feature Matrix

| Action                       | Allowed Plans | Required Role                | Enforcement Point                             | UI When Denied                                      | Audit Logging                          |
| ---------------------------- | ------------- | ---------------------------- | --------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| Create Security Pack request | Enterprise    | Workspace member             | API `/api/security-pack/request` (plan check) | Disable/tooltip; message “Enterprise plan required” | Log denial in API response (403)       |
| Approve / reject request     | Enterprise    | Security/Legal (internal)    | API `/api/security-pack/request/:id/decision` | Not exposed to customers                            | Logged via audit event                 |
| View audit timeline          | Enterprise    | Requester or workspace admin | API `/api/security-pack/request/:id`          | Show 403 message                                    | Log denial (403)                       |
| Resolve download link        | Enterprise    | Requester or workspace admin | Download resolver + delivery check            | Hide CTA                                            | No event mutation; optional access log |
| View workspace audit feed    | Enterprise    | Workspace admin              | API `/api/security-pack/audit`                | Show 403 message                                    | Log denial (403)                       |

## Enforcement Flow (Text)

1. UI calls API → API checks `hasEnterpriseAccess(workspaceId, userId)` (single source of truth).
2. If plan/role fail → API returns 403; UI hides/disabled state with factual message.
3. If allowed → proceed with action and append audit events where applicable (never mutate existing events).
4. Download links are resolved only after DELIVERY_MARKED and access check; links are generated on demand.
5. Denied attempts are not retried client-side; user sees the 403 state.

## Gating Helper Contract

- `hasEnterpriseAccess(workspaceId: string, userId: string): Promise<boolean>`
  - Checks workspace plan == Enterprise (backend plan resolution).
  - Verifies user membership (for member/admin actions).
  - Used in: request creation API, timeline API, audit feed API, download resolver, decision endpoints.
  - UI may call a lightweight endpoint or rely on API responses; UI must not assume access without backend confirmation.

## Notes

- No frontend-only enforcement; all critical checks reside in API/backend.
- No duplicated plan logic: use the single helper everywhere.
- Denied attempts should be observable in logs (403 responses) but do not mutate audit events.

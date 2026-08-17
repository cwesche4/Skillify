# Contract-Level Entitlements (Security Pack)

Entitlements are contract-granted capabilities, enforced in the backend. Plan labels map to entitlements once in billing; APIs rely only on entitlements, not plan names.

## Entitlement Definitions

- `SECURITY_PACK_REQUEST`: May create Security Pack requests.
- `SECURITY_PACK_DOWNLOAD`: May resolve/download Security Pack artifacts.
- `SECURITY_PACK_APPROVAL_INBOX`: May review/approve Security Pack requests (internal roles).
- `WORKSPACE_AUDIT_FEED`: May view workspace-level Security Pack audit feed.
- `SERVICE_TOKEN_AUTOMATION`: May use automation service tokens for callbacks.
- `CUSTOM_APPROVAL_ROLES`: May use custom approval roles beyond default Security/Legal/GRC.

Each entitlement has: `key`, `description`, `grantedAt`, optional `expiresAt`, `source` (contract | amendment | exception).

## Enforcement Flow

1. Billing/contract layer maps plan → entitlements (once).
2. APIs check entitlements only; no plan-name logic in routes.
3. UI reflects API responses; no assumptions based on plan label.

## API Check Examples

- Create request: require `SECURITY_PACK_REQUEST` + workspace membership.
- Download/artifact: require `SECURITY_PACK_DOWNLOAD` + requester/admin + delivery event.
- Approval inbox: require `SECURITY_PACK_APPROVAL_INBOX` + reviewer role.
- Audit feed: require `WORKSPACE_AUDIT_FEED` + workspace admin.
- Automation callbacks: require `SERVICE_TOKEN_AUTOMATION` scope.

## UI Behavior

- Show disabled/hide based on backend responses; explain missing entitlement factually (“This action requires Security Pack entitlement on your contract.”).
- No plan-label assumptions in UI logic.

## Audit & Logging Notes

- Denials for missing entitlements return 403 and may be logged as access denials (separate from audit events).
- Entitlement changes (grants/revokes) should be logged in contract history; not in Security Pack audit events.

## Sales/Legal Alignment

- Entitlements reflect contract terms; ensure sales/legal confirm which entitlements apply to each customer.
- Exceptions or amendments should add entitlements explicitly (source = amendment/exception).

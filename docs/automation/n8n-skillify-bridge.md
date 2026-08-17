# n8n → Skillify Security Pack Delivery Callback

Defines how n8n marks Security Pack delivery in Skillify using service-token auth and append-only logging.

## Request Contract

- **Method/Path:** `POST /api/security-pack/request/:id/delivered`
- **Headers:**
  - `Authorization: Bearer <SERVICE_TOKEN>` (hashed in Skillify; must be active and scoped to SECURITY_PACK_DELIVERY)
  - `Content-Type: application/json`
  - `X-Correlation-Id: <optional-correlation-id>` (preferred over body field)
- **Body:**
  ```json
  {
    "deliveryMethod": "AUTOMATED",
    "automationSystem": "N8N",
    "correlationId": "n8n-run-abc123" // optional if not sent via header
  }
  ```

## Validation Steps (Skillify)

1. Extract bearer token; hash and look up active `AutomationServiceToken` with `SECURITY_PACK_DELIVERY` scope.
2. If invalid/revoked/insufficient scope → 401/403.
3. Resolve `requestId` from path; fetch request to obtain workspaceId.
4. Capture correlationId from `X-Correlation-Id` header (or body fallback).
5. Append `DELIVERY_MARKED` `SecurityPackAuditEvent` with workspaceId, requestId, automationSystem, deliveryMethod, correlationId. No payloads stored.

Note: n8n must not retry after a 200 response; repeated callbacks are treated as no-ops.

## Audit Event Written

- Event type: `DELIVERY_MARKED`
- Fields: requestId, workspaceId, automationSystem (e.g., N8N), deliveryMethod (e.g., AUTOMATED), correlationId (if provided).
- Guarantees: Append-only, no payload contents, workspace-scoped.

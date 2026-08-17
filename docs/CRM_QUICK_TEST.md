# CRM Quick Test (HubSpot)

Use this to manually verify the HubSpot integration in a workspace.

## 1) Required env vars

- `INTEGRATIONS_ENCRYPTION_KEY` — base64 32 bytes (openssl rand -base64 32)
- `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`
- Place them in `.env.local` (dev) or your secret store (prod). Do not commit secrets.

## 2) Connect HubSpot

1. Go to `/dashboard/{workspaceSlug}/settings/integrations` (OWNER/ADMIN).
2. Click **Connect HubSpot** → approve OAuth.
3. Success should show “Connected” and an audit log entry `CRM_CONNECTED`.

## 3) Test connection

1. Click **Test connection** on the same page.
2. Expect `{ ok: true, ... }` or a clear error.
3. Audit should record `CRM_TEST_CONNECTION` (success or failure) and update integration metadata timestamps.

## 4) Configure webhook

1. In HubSpot, set the webhook target to `POST /api/integrations/hubspot/webhook`.
2. Enable signatures (v3). Use contact/deal/company change events.
3. Trigger a change (e.g., update a contact). Expect audit `CRM_WEBHOOK_RECEIVED`.
4. If an automation has a matching crm-trigger, an AutomationRun should be created; audit logs `CRM_TRIGGER_FIRED`.

### Dev-only shortcut

If you need a quick local test without HubSpot, use the simulator (dev only):

- POST `/api/integrations/hubspot/simulate-webhook`
- JSON body: `{ "workspaceId": "<id>", "objectType": "contact", "event": "created", "externalId": "123" }`
- It skips signature verification but still dedupes, rate-limits, and triggers automations.

## 5) Run a CRM action node

1. Add a crm-action node (e.g., “update contact”) to an automation.
2. Execute the automation.
3. Verify the change in HubSpot and an audit entry `CRM_ACTION_EXECUTED` (or `CRM_ACTION_FAILED` if blocked/rate-limited).

## 6) Where to inspect audit logs

- API: `/api/workspaces/{workspaceId}/audit`
- UI: Admin → Audit log (if enabled in your plan/role)
- Look for CRM events: CONNECTED, TEST_CONNECTION, WEBHOOK_RECEIVED/REJECTED, TRIGGER_FIRED, ACTION_EXECUTED/FAILED.

## How to test HubSpot integration (manual)

1. Ensure env vars are set: `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`, `INTEGRATIONS_ENCRYPTION_KEY` (base64 32 bytes).
2. From the integrations page `/dashboard/:workspace/settings/integrations`, click “Connect HubSpot”. Complete OAuth; callback should mark status connected.
3. Click “Test connection”; expect `{ ok: true }`. Failures return `{ ok: false, error }` and are audit-logged.
4. In HubSpot, configure webhook to `POST https://your-app.com/api/integrations/hubspot/webhook` with the scopes you enabled. Trigger a contact update/create.
5. Create an automation with a `crm-trigger` node matching provider=hubspot, objectType=contact, event=updated. Confirm an AutomationRun is created on webhook.
6. Add a `crm-action` node (e.g., contact.update with properties) and run the automation; verify the contact updates in HubSpot.
7. Check `AuditLog` entries for CRM_CONNECTED, CRM_TEST_CONNECTION, CRM_WEBHOOK_RECEIVED/REJECTED, CRM_TRIGGER_FIRED, CRM_ACTION_EXECUTED/FAILED, CRM_TOKEN_REFRESHED.

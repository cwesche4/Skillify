## End-to-end checklist

- Env validated lazily: HUBSPOT_CLIENT_ID/SECRET/REDIRECT_URI and INTEGRATIONS_ENCRYPTION_KEY (base64 32-byte) are required when CRM is used; failures throw clear errors.
- Permissions: only workspace OWNER/ADMIN can connect, disconnect, or test integrations; members can run automations (including CRM actions) but cannot manage integrations.
- Plan gating: Pro for connect/actions, Elite for inbound webhooks; enforced in connect/test/webhook/executor.
- Webhooks: signatures verified, Elite-gated, normalized payload, deduped via audit log key, capped to avoid bursts, audit logs emitted.
- Actions: tokens decrypted/refreshable, rate-limited per run (soft cap), audit logs emitted for success/failure, runs never crash on CRM errors.
- UI: Integrations page shows plan requirements; buttons disable with reasons; sidebar Settings works.

## Manual test steps

1. Set envs (HubSpot keys + base64 32-byte INTEGRATIONS_ENCRYPTION_KEY). Start dev.
2. Connect HubSpot via integrations page as OWNER/ADMIN (member should be blocked).
3. Test connection: expect `{ ok: true, hubId }`; failure returns `{ ok: false, error }` and is audit-logged.
4. Configure HubSpot webhook to `/api/integrations/hubspot/webhook`; trigger contact update/create; confirm automation with matching crm-trigger fires (AutomationRun created).
5. Add crm-action node (contact.update / note.create / deal.update_stage); run automation; confirm HubSpot update and audit logs.
6. Disconnect as OWNER/ADMIN; confirm status updates and audit logs.

## Failure scenarios & expected audit logs

- Missing/invalid env: clear error thrown when invoking CRM routes/adapters.
- Non-OWNER/ADMIN connect/test/disconnect: 403.
- Plan insufficient: connect/test (not Pro) or webhook (not Elite) → 403; audit `CRM_WEBHOOK_REJECTED` with reason.
- Token refresh/action failure: `CRM_ACTION_FAILED` with error; run continues.
- Webhook signature failure: 400; no trigger fired.
- Rate limit (actions > cap or webhook > cap): `CRM_ACTION_RATE_LIMITED` or `CRM_WEBHOOK_RATE_LIMITED`; execution continues within cap.

## Production-ready criteria

- Env/plan/permission checks enforced; CRM ops can’t crash the app.
- Webhook dedupe guard and burst cap in place.
- Audit logs cover connect/disconnect/test/webhook received/rejected/trigger fired/action executed/failed/token refreshed/rate-limited with provider/objectType/event/integrationId/automationId where applicable.

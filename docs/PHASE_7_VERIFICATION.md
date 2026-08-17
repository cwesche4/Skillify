## What to verify in Phase 7

- Provider stubs: Salesforce and Pipedrive adapters exist, registered, and clearly throw “not implemented”. UI shows “Coming soon”.
- Health endpoint: `GET /api/integrations/{provider}/health?workspaceId=...` returns connection status and lastSuccessfulActionAt/lastWebhookAt/lastError from metadata (OWNER/ADMIN only).
- Circuit breaker: 5+ failures in 10 minutes set breaker open, logs `CRM_CIRCUIT_OPENED`; after quiet period auto-resets and logs `CRM_CIRCUIT_RESET`. Webhooks stop firing automations when breaker is open; actions return “circuit open”.
- Rate caps: per-run 10 actions (hard stop, audit `CRM_ACTION_RATE_LIMITED`); webhook burst capped at 25 automations (audit `CRM_WEBHOOK_RATE_LIMITED` with reason). Daily limit placeholder enforced via audit only (see executor caps).
- Audit coverage: every CRM path logs with provider/objectType/event/integrationId/automationId when applicable; no silent failures.

## Manual test steps

1. As OWNER/ADMIN, connect HubSpot (or use existing) and run a few CRM actions; confirm `lastSuccessfulActionAt` updates and `/health` returns connected with timestamps.
2. Force action failures (bad token) 5+ times; ensure breaker opens (actions/webhooks skip, audit `CRM_CIRCUIT_OPENED`). Wait 10+ minutes or clear failures; confirm `CRM_CIRCUIT_RESET`.
3. Send multiple matching webhooks (>25); only first 25 automations fire; audit `CRM_WEBHOOK_RATE_LIMITED`. Dedup key prevents duplicate runs per event.
4. Run an automation with >10 CRM actions in one run; remaining actions are skipped with `CRM_ACTION_RATE_LIMITED`.
5. Verify permissions: connect/disconnect/test/health blocked for MEMBER; actions still run for Member-role automations.

## Production-ready confirmation

- Env validated lazily; actions/webhooks cannot crash the app.
- Circuit breaker and rate caps guard failures/bursts.
- Health endpoint gives operational visibility.
- Audit logs cover connect/disconnect/test/webhook received/rejected/rate-limited/trigger fired/action executed/failed/rate-limited/circuit opened/reset/token refreshed.

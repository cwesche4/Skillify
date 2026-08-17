## Flow overview

- Webhook → adapter verifies signature → normalized payload `{provider, objectType, event, externalId, occurredAt, raw}` → webhook route enforces Elite plan and logs `CRM_WEBHOOK_RECEIVED` → matching automations (crm-trigger nodes normalized via `matchTriggerNode`) are invoked via `runAutomation` → each fire logs `CRM_TRIGGER_FIRED` with a dedupeKey to avoid repeat runs.
- Actions → executor resolves adapter, enforces Pro+, decrypts tokens, calls adapter, upserts `ExternalRecord`, and logs `CRM_ACTION_EXECUTED` or `CRM_ACTION_FAILED` without crashing the run.
- Audit logs are emitted for connect/disconnect, test connection, webhook received/rejected, trigger fired, action executed/failed, token refresh.
- Plan gating: Pro for connect/actions; Elite for webhooks; enforced in connect, test, webhook routes, and executor.

## Deduping

- Webhook handler builds a dedupeKey `{provider}:{objectType}:{externalId}:{event}:{occurredAt}` and skips firing an automation if a `CRM_TRIGGER_FIRED` audit with that key already exists for that automation.

## Matching

- Trigger matching uses normalized provider/objectType/event via `matchTriggerNode` to avoid case/alias drift; only active automations in the workspace are considered.

## Error handling

- Signature/plan failures return 4xx and log `CRM_WEBHOOK_REJECTED`.
- Adapter/action errors are caught, logged, and surfaced in node output; runs do not crash.
- Token refresh errors are logged (`CRM_TOKEN_REFRESHED` on success); decrypt failures or missing tokens return errors in actions/tests.

## Where to look

- Webhook: `app/api/integrations/[provider]/webhook/route.ts`
- Actions: `lib/automations/executor.ts` (crm-action branch)
- Normalization: `lib/integrations/normalize.ts`
- Env/key validation: `lib/integrations/env.ts`, `lib/integrations/crypto.ts`
- Audit log guarantees: see above events; all critical CRM paths emit audit entries.

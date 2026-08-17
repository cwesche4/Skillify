# CRM Entitlement Hooks (Salesforce/CRM)

Emit contract and entitlement lifecycle events to external CRMs without exposing system internals or payload data.

## Event Schema

- `type`: ENTITLEMENT_GRANTED | ENTITLEMENT_REVOKED | CONTRACT_AMENDED | SECURITY_PACK_ENABLED
- `workspaceId`: string
- `entitlementKey`: string
- `action`: mirrors `type` where applicable
- `effectiveAt`: ISO timestamp
- `source`: CONTRACT | AMENDMENT | EXCEPTION | RENEWAL
- `idempotencyKey`: unique per event emission

No artifact payloads, user PII, or pricing data is included.

## Delivery Model

- Preferred: webhook or message queue publisher (pluggable sink).
- Delivery is optional per customer; hooks can be disabled per workspace/contract.
- Events are emitted after entitlement change is recorded (append-only audit remains unchanged).

## Retry & Idempotency

- Include `idempotencyKey` to dedupe on the receiver side.
- Retries on non-2xx responses with exponential backoff; give up after bounded attempts.
- No duplicate audit writes; retries only re-send the same event envelope.

## Security Notes

- Webhooks should use HMAC signing with shared secret; no bearer tokens reused from other systems.
- Workspace-scoped data only; no cross-tenant information.
- Minimal metadata only; no payload contents or pricing.
- Opt-in per customer; if disabled, no external emissions occur.

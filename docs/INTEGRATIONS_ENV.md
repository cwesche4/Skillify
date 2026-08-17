# CRM Integration Environment Variables

Set these only when you plan to use CRM integrations. They are lazily validated via `ensureIntegrationEnv()` so non-CRM environments do not crash at startup.

## Required variables

- `INTEGRATIONS_ENCRYPTION_KEY` — **base64-encoded 32-byte key**. Generate with:
  - `openssl rand -base64 32`
  - The value must decode to exactly 32 bytes or encryption will throw: “must be base64 and decode to 32 bytes”.
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `HUBSPOT_REDIRECT_URI`

## Usage tips

- Place secrets in `.env.local` (dev) or your deployment secret store (prod). Do not commit secrets.
- `INTEGRATIONS_ENCRYPTION_KEY` is consumed by `lib/integrations/crypto.ts` (AES-256-GCM).
- HubSpot keys are loaded lazily by `lib/integrations/env.ts` inside CRM routes/actions, so non-CRM pages keep running even if these are unset.

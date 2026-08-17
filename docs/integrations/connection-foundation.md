# Integration Connection Foundation

Skillify uses two separate credential layers.

## Platform credentials

Platform credentials identify the Skillify application to external providers.
They belong in server-only environment variables locally and in Vercel.

Examples:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `MICROSOFT_CALENDAR_CLIENT_ID`
- `MICROSOFT_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_REDIRECT_URI`
- `TWILIO_CONNECT_APP_SID`
- `TWILIO_CONNECT_CALLBACK_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `INTEGRATIONS_ENCRYPTION_KEY`
- `SECRET_ENCRYPTION_KEY`

Do not put customer access tokens, customer API keys, Twilio account
authorizations, CalDAV app passwords, or workspace webhook secrets in Vercel.

## Workspace credentials

Workspace credentials belong to a customer workspace and are normally stored in
the database through `WorkspaceIntegrationConnection`. Secret payloads are
encrypted with the integrations AES-256-GCM envelope before persistence. API
responses return only safe metadata such as provider ID, status, account label,
scopes, timestamps, and masked credential hints.

Examples:

- Google access and refresh tokens
- Microsoft access and refresh tokens
- HubSpot tokens
- customer Resend API key
- Twilio connected-account authorization
- CalDAV server credentials
- provider account IDs and selected resource IDs

Google, Microsoft, Apple, and CalDAV calendar sync retain the provider-specific
`CalendarConnection` storage used by the Scheduling sync engine. The generic
integrations list projects those records as safe management connections, but it
does not copy live calendar tokens into a second credential store.

## Capabilities and health

Connection status alone is not a capability grant. Skillify resolves provider
capabilities from:

- the provider registry
- deployment availability
- workspace connection status
- granted scopes
- provider-specific readiness metadata

For example, a Resend connection is not allowed to send business email until its
workspace domain is verified, and SMS is not available until a customer-owned
Twilio connection is actually ready.

Health checks are safe local diagnostics unless a provider-specific live check
has been explicitly implemented. They may validate registry availability,
connection status, credential-envelope decryptability, and last known sync or
error metadata. Raw provider secrets and provider error payloads must not be
returned to customer-facing pages.

## Notifications

Notification preferences are separate from integration connection state.
Enabling a channel does not prove provider readiness:

- in-app notifications are Skillify-native
- platform email is reserved for account, security, billing, and invitation
  messages
- workspace business email requires a verified workspace Resend sender
- SMS requires a customer-owned Twilio connection
- Slack remains unavailable until that provider is implemented

## Lead intake

Lead intake sources share one normalized intake contract for native forms,
inbound webhooks, HubSpot, future ad lead forms, imports, and manual entry.
Sources that are not implemented must remain visible as coming soon or partial
where useful, but they must not present fake connection success.

## Provider console checklist

Google Calendar:

- Create or select the production Google Cloud project.
- Enable the required Calendar APIs.
- Configure the OAuth consent screen.
- Create a web application OAuth client.
- Add exact development, preview, and production redirect URIs.
- Add test users or complete verification where Google requires it.

Microsoft Outlook Calendar:

- Create an Entra application registration.
- Configure supported account types for customer authorization.
- Add exact redirect URIs.
- Add delegated calendar permissions.
- Create the client secret or certificate used by Skillify.

Twilio:

- Create the Twilio customer-authorization or Connect application.
- Configure the callback URL.
- Confirm requested permissions and customer billing behavior.
- Customers connect their own Twilio accounts, and Twilio bills them directly
  for phone numbers and message usage.

Resend:

- Customers create a sending-only API key in their own Resend account.
- Customers verify their own sending domain.
- Skillify stores the workspace key encrypted and never redisplays it.
- Skillify platform/account/security email remains routed through platform
  email, not through a customer sender.

## Local versus production

Use local callback URLs for development and HTTPS production URLs in Vercel.
Do not hardcode localhost or production domains in provider code. Provider
availability should report `configurationRequired` when deployment variables are
missing or disabled, and unrelated native Skillify features must continue to
work.

## Rotation and recovery

Rotate platform secrets in Vercel. Rotate workspace credentials by reconnecting
the provider or replacing the workspace API key. If encrypted credentials cannot
be decrypted, classify the connection as reconnect required and do not expose
raw provider errors or credential payloads.

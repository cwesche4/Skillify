# Security Pack Deployment Hardening (Vercel + Clerk + Prisma)

Defense-in-depth checklist for production deployment. No dev-only assumptions; least-privilege throughout.

## Environment Matrix

- **Prod:** Entitlement mutation endpoint enabled (service token only). All security pack routes active. Secrets stored in Vercel env; Clerk production instance.
- **Preview:** Entitlement mutation endpoint disabled or token not provisioned; Security Pack routes gated; data uses staging DB.
- **Local:** Entitlement mutation endpoint disabled; use mock/stub entitlements; no real service tokens.

## Checklist

### 1) Environment Separation

- Use separate env vars for prod/preview/local; never share service tokens across envs.
- Ensure `/api/internal/entitlements` is only usable in prod by withholding tokens elsewhere.
- Validate that preview/local deployments cannot access prod database or tokens.

### 2) Clerk Hardening

- Reviewer roles (Security/Legal/GRC) are enforced server-side on approval inbox routes.
- Internal-only routes rely on Clerk auth plus entitlement checks; no public exposure.
- Sessions must be required for all user-facing routes; no anonymous access.
- No user-driven entitlement changes; entitlements are contract-driven and system-mutated only.

### 3) Service Token Security

- Scopes limited (e.g., `SECURITY_PACK_DELIVERY`, `ENTITLEMENT_ADMIN`); tokens hashed and compared constant-time.
- Rotation: issue new token, deploy, then revoke old token; tokens stored only hashed.
- Revocation: set `active=false`/`revokedAt`; revoke in DB to invalidate immediately.
- Idempotency: delivery callbacks are no-ops on retry after success; entitlement mutations are single-write.

### 4) Prisma & DB Controls

- Append-only expectations for `SecurityPackAuditEvent`, `EntitlementAuditEvent`; no update/delete paths.
- No cascade deletes on audit tables; workspaceId remains scalar (no FK cascade).
- Indexing present for audit timelines and entitlement history (workspaceId + createdAt).
- Backup/restore: standard DB backups required; append-only tables facilitate point-in-time review.

### 5) Vercel Controls

- Route protection: API routes enforce auth/entitlements; internal routes not exposed without valid tokens.
- Secrets: store service token secrets and DB URLs in Vercel env vars; avoid logging secrets.
- Logging boundaries: avoid logging payloads/PII; log metadata only if needed.
- Webhook verification: service token HMAC or bearer validation on callbacks; constant-time hash comparison.

### 6) Incident Readiness

- Kill-switches: global and workspace AI kill switches remain in effect; Security Pack routes still enforce entitlements.
- Token revocation: immediate by marking inactive/revoked; no cache of valid tokens.
- Audit survivability: append-only audits + backups ensure post-incident review; downloads require delivery events and entitlements (404 otherwise).

## Security Sign-Off Notes

- Ensure production service tokens with required scopes are provisioned and stored hashed.
- Validate env separation before enabling entitlement mutation endpoint in prod.
- Confirm monitoring/alerts on unauthorized token use attempts and repeated 401/403 on internal routes.

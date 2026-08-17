# Skillify Launch Checklist (v1.0.0)

## Infrastructure

- [ ] Vercel production deployment successful
- [ ] ENV vars set in Production:
  - DATABASE_URL
  - CLERK_SECRET_KEY
  - CLERK_PUBLISHABLE_KEY
  - INTEGRATIONS_ENCRYPTION_KEY (base64, 32 bytes)
  - HUBSPOT_CLIENT_ID
  - HUBSPOT_CLIENT_SECRET
  - HUBSPOT_REDIRECT_URI
- [ ] Postgres reachable from prod
- [ ] Prisma migrations applied

## CRM

- [ ] HubSpot OAuth connect works
- [ ] Test connection passes
- [ ] Webhook receives event
- [ ] CRM trigger fires automation
- [ ] CRM action executes successfully
- [ ] Audit logs recorded (WEBHOOK_RECEIVED → ACTION_EXECUTED)

## Automation

- [ ] Automation run completes
- [ ] Failure attribution visible
- [ ] Timeline renders correctly
- [ ] Guardrails trigger safely

## Security & Ops

- [ ] Kill switch works
- [ ] Circuit breaker opens/closes correctly
- [ ] Admin CRM Ops page loads
- [ ] Export endpoints return data

## UX

- [ ] No console errors in dashboard
- [ ] Builder loads without crashes
- [ ] Integrations page stable

## Final

- [ ] v1.0.0 tag pushed
- [ ] Smoke test complete

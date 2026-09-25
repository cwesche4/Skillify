# Simple Automations production operations

Skillify deploys the application to Vercel. The repository-owned schedules in
`vercel.json` invoke only authenticated internal routes:

- native domain events and durable HubSpot ingress: every minute;
- Scheduling outbox, reminders, and deliveries: every minute;
- expired Scheduling lease recovery: every five minutes;
- bounded recurrence-horizon extension: daily at 02:00 UTC.

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to `GET` routes. Manual
or non-Vercel invocations retain their existing authenticated `POST` contracts.
Never put a token in `vercel.json` or a query string.

## Production environment prerequisites

Configure these values in the production environment only after migration
history is reconciled and staging rehearsal succeeds:

- `CRON_SECRET`: authenticates Vercel Cron GET requests;
- `SCHEDULING_WORKER_SECRET`: authenticates manual Scheduling POST requests;
- `AUTOMATION_SERVICE_TOKEN` (or the legacy `INTERNAL_SERVICE_TOKEN` fallback):
  authenticates operator and manual native-worker requests;
- `AUTOMATION_SERVICE_SCOPES`: include `DOMAIN_EVENT_PROCESSOR` and
  `AUTOMATION_OPERATIONS`;
- `AUTOMATION_SERVICE_SYSTEM`: stable operator-system audit label;
- `SCHEDULING_NOTIFICATIONS_ENABLED=true` when production delivery is approved;
- the existing HubSpot credentials, including `HUBSPOT_CLIENT_SECRET`, for
  signed webhook verification.

Do not configure or rotate these values through repository code.

## Health and recovery

`GET /api/internal/automation-operations/diagnostics` requires the
`AUTOMATION_OPERATIONS` service scope. It reports payload-free backlog, age,
terminal-failure, overdue-reminder, failed-run, and latest-completed-work
signals. Vercel Cron invocation history is authoritative for successful empty
runs; database timestamps intentionally represent completed work rather than a
fabricated heartbeat.

`POST /api/internal/domain-events/recover` requires the same scope and an exact
`workspaceId` plus `eventId`. It recovers one eligible `DEAD` event, records an
append-only audit event, and cannot reset successful or non-terminal work.

## Deployment boundary

Repository readiness does not authorize production deployment. The next step
is read-only production migration-history inspection, followed by a migration
reconciliation plan and production-equivalent staging rehearsal. Do not use
`prisma db push` or alter production migration state ad hoc.

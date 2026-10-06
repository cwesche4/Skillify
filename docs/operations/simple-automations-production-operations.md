# Simple Automations production operations

Skillify deploys the application to Vercel. The repository-owned schedules in
`vercel.json` invoke only authenticated internal routes:

- `GET /api/internal/domain-events/process`: native domain events and durable
  HubSpot ingress, every minute;
- `GET /api/internal/scheduling/notifications`: Scheduling outbox, reminders,
  and deliveries, every minute;
- `GET /api/internal/scheduling/notifications/recovery`: expired Scheduling
  lease recovery, every five minutes;
- `GET /api/internal/scheduling/recurrence-horizon`: bounded
  recurrence-horizon extension, daily at 02:00 UTC;
- `GET /api/internal/estimates/deliveries/process`: Estimate delivery and
  follow-up processing, every minute.

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
- `SCHEDULING_NOTIFICATIONS_ENABLED=true` when internal Scheduling processing
  and recurrence are approved (this is broader than email delivery);
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

The diagnostics also report bounded, payload-free Estimate delivery and
follow-up aggregates: pending/processing/retryable/permanent counts, stale
leases, oldest eligible or overdue age, and last successful send/dispatch.
They never return recipient addresses, share tokens, provider identifiers,
credentials, or raw error payloads. `lastSentAt` means the delivery provider
accepted the Estimate message; it is not proof that the message reached the
recipient's inbox. `lastDispatchedAt` means the follow-up was handed to the
delivery queue, not that delivery later succeeded.

`POST /api/internal/domain-events/recover` requires the same scope and an exact
`workspaceId` plus `eventId`. It recovers one eligible `DEAD` event, records an
append-only audit event, and cannot reset successful or non-terminal work.

## Deployment boundary

Repository readiness does not authorize production deployment. The next step
is read-only production migration-history inspection, followed by a migration
reconciliation plan and production-equivalent staging rehearsal. Do not use
`prisma db push` or alter production migration state ad hoc.

## Controlled-cohort ownership and cadence

Assign one named operator before enabling the cohort. This repository does not
provide active paging or alert delivery. The operator must review authenticated
diagnostics and hosting cron invocation logs daily, and begin incident review
whenever a minute worker misses two expected invocations or an eligible backlog
is older than five minutes. Those conservative thresholds account for normal
retry delays while keeping the controlled cohort small enough for manual
oversight.

## Scheduling processing flag

`SCHEDULING_NOTIFICATIONS_ENABLED=false` (or missing) is a broad Scheduling
worker kill switch. It stops Scheduling outbox processing, reminders,
notification deliveries, Simple Scheduling automations, recurring Job
reconciliation/materialization, and expired-lease recovery. It does not merely
disable outbound email.

Use this rollout order:

1. Keep the global flag false while configuring the environment.
2. Verify scheduler authentication and route invocation without changing the
   flag.
3. Keep every Workspace Scheduling email preference false.
4. Set the global flag true only when in-app Scheduling processing and
   recurrence are ready.
5. Verify in-app Scheduling processing and recurring Job reconciliation.
6. Separately configure and verify the platform Resend sender.
7. Enable Scheduling email for one test Workspace and verify both successful
   delivery and failure visibility.
8. Expand only after that test Workspace demonstrates both delivery and safe
   failure handling.

## Controlled-launch incident runbook

| Incident                              | Signal and threshold                                                                        | Safe first response and recovery                                                                                                                                                                                                                  | Stop and escalate when                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Domain Event queue stopped            | `nativeDomainOutbox.oldestEligiblePendingAgeMs > 300000`, or two missing minute invocations | Check cron invocation/auth logs, then worker diagnostics. Automatic retry and stale-claim handling remain authoritative. A single `DEAD` event may be recovered only through the authenticated one-event recovery route after eligibility review. | Authentication is valid but age grows, multiple events become `DEAD`, or recovery eligibility is unclear.            |
| Estimate email stuck PENDING          | `estimates.deliveries.pending > 0` with `oldestEligibleAgeMs > 300000`                      | Check Estimate worker invocation, sender configuration, and delivery status. PENDING/FAILED/stale PROCESSING are automatically claimed. Management may resend only through the existing Estimate UI after correcting configuration.               | A permanent failure repeats, the sender is unverified, or safe idempotency cannot be established.                    |
| Estimate follow-up overdue            | `estimates.followUps.overdue > 0` with `oldestOverdueAgeMs > 300000`                        | Verify the Estimate worker cron, active recipe, and Workspace timezone/config. Scheduled/FAILED/stale PROCESSING rows recover automatically. There is no generic manual retry button.                                                             | The recipe/config is inconsistent, a row is permanently failed, or repeated dispatch fails.                          |
| Scheduling notification stuck         | Scheduling/reminder backlog older than five minutes or stale processing count               | Confirm the broad Scheduling flag is true, then check cron auth and Workspace preferences. Existing retry/lease recovery handles retryable work.                                                                                                  | Permanent delivery failure, cross-workspace mismatch, or repeated lease loss appears.                                |
| Recurrence/materialization backlog    | Recurrence materialization timestamp stops advancing while eligible occurrences exist       | Confirm the Scheduling flag and outbox worker. Check for `RECURRING_SERVICE_MEMBER_ASSIGNMENT_REQUIRED`; historical TEAM-assigned services must be reassigned to MEMBER before future materialization.                                            | A MEMBER-assigned service still fails, reconciliation is non-idempotent, or source Scheduling state is inconsistent. |
| Provider permanent failure            | Permanent delivery count increases                                                          | Inspect only bounded error codes/logs, correct provider/sender configuration, then use the supported management resend path where available.                                                                                                      | Credentials, DNS, provider account state, or production secrets need changes not authorized by the incident owner.   |
| Failed Simple Automation              | `simpleAutomations.failedRuns` or per-recipe count increases                                | Verify installation lifecycle/readiness and inspect management-only run history. Retry only through an existing recipe-specific safe path.                                                                                                        | No supported retry exists, duplicate delivery risk is unknown, or failure crosses Workspace scope.                   |
| Stale lease/recovery issue            | Any stale-processing count persists past the next recovery invocation                       | Verify recovery cron authentication and worker fencing. Let the existing lease reclaim path win; do not edit queue rows directly.                                                                                                                 | Reclaims repeat, two workers appear to own one claim, or fencing cannot be proved.                                   |
| Customer reports missing notification | No matching sent/delivery progress for the expected Estimate or Scheduling action           | Confirm the feature and Workspace preference were enabled, inspect bounded diagnostics, then use the supported management resend if the record remains eligible.                                                                                  | The customer address/token would need to be exposed in diagnostics, or external delivery cannot be verified safely.  |
| Worker authentication failure         | 401/403 in hosting invocation logs or two missed expected invocations                       | Verify the correct secret and service scope are attached to the intended route. Do not put secrets in URLs or repository files.                                                                                                                   | Rotation or environment changes require production authority, or route/system identity is ambiguous.                 |
| Scheduler stopped invoking            | No hosting invocation for two expected minute intervals                                     | Confirm the repository schedule and hosting scheduler status. Keep queue state untouched while invocation is restored.                                                                                                                            | Hosting configuration must change or production access is required.                                                  |

Automatic retry and stale-lease reclaim are not substitutes for manual review of
permanent failures. Manual recovery is limited to the existing one-event Domain
Event recovery route and management Estimate resend flow. Direct queue-row
editing is unsupported.

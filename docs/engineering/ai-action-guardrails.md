# How to Safely Modify AI Actions

Developer guidance to keep AI action governance intact. Do not change policies; follow the existing enforcement hooks.

## Required Gates

- **Global + workspace kill switch**: All AI action routes must call `assertAiActionsEnabled` before processing. Keep this check first.
- **Role/membership checks**: Enforce workspace membership/admin rules already used in each route; do not relax guards.

## Required Hooks

- **Audits**: Every successful or denied action must append to `AiActionAudit` via `recordAiActionAudit`. Include before/after snapshots, `wasDenied`, and reasons. Integrity hash is computed automatically—do not bypass.
- **Metrics**: Emit structured metrics (`emitAiMetric` + `buildAiMetric`) for attempted/applied/denied/undone/rate-limited events.
- **Alerts**: Trigger `emitAiAlert` for denial spikes, rate-limit spikes, and undo conflicts.

## Kill Switch Checks

- Respect global env `AI_ACTIONS_GLOBALLY_DISABLED`. Workspace-level setting (`aiActionsEnabled`) must be enforced through `assertAiActionsEnabled`.

## Anti-Patterns (Avoid)

- **Skipping server checks**: Do not rely on client flags to hide AI actions; always enforce on the server.
- **Optimistic toggles**: Do not assume success; reflect server responses and handle errors.
- **Mutating audits**: Never update or delete `AiActionAudit` rows; append only.
- **Leaking payloads**: Do not log or emit PII/payload contents in metrics/alerts.
- **Ad hoc rate limits**: Use `checkAiActionRate`; do not roll bespoke throttles per route.

## When Adding New AI Actions

1. Add kill-switch guard at the top of the route.
2. Add membership/role checks as applicable.
3. Log audits with before/after and reasons.
4. Emit metrics and relevant alerts.
5. Update docs/registry if new control surface is introduced.

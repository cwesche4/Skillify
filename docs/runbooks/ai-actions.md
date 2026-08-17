# AI Actions Incident Runbook

## Scope

Operational guidance for AI action governance issues: global disablement, workspace kill switch denials, rate-limit spikes, and undo conflict storms. No runtime changes are made by this document.

## Signals & Symptoms

- **Global disablement**: API responses `503` with `AI actions are globally disabled.`; metrics `ai_action_denied` with reason `ai_actions_disabled`; alerts may be absent if env set intentionally.
- **Kill switch denials**: API responses `403` with `AI actions are disabled for this workspace.`; audit entries with `wasDenied=true` and reason `ai_actions_disabled`.
- **Rate-limit spikes**: API responses `429` with `retryAfterMs`; metrics `ai_action_rate_limited`; alerts `rate_limit_spike`.
- **Undo conflict storms**: Undo API `409 Conflict`; alerts `undo_conflict_spike`; audits with `reason=conflict_detected`.

## Probable Causes

- Global env toggle `AI_ACTIONS_GLOBALLY_DISABLED=true` set for emergency.
- Workspace setting `aiActionsEnabled=false` (intentional or drift).
- High-volume automation usage or script causing bursts (rate-limit).
- Stale client state or concurrent edits causing node data hash mismatches (undo conflicts).

## Immediate Actions

- **Global disablement**: Confirm env intent with on-call lead; if accidental, unset `AI_ACTIONS_GLOBALLY_DISABLED` and redeploy/restart as per release SOP.
- **Kill switch denials**: Verify workspace setting via `GET /api/workspaces/{id}/settings/ai-actions`; if wrong, an admin can `PUT` with `aiActionsEnabled:true`.
- **Rate-limit spikes**: Identify workspaceId in metrics/alerts; coordinate with workspace admin to throttle requests; consider temporary plan-based limits documented in rate limiter if needed.
- **Undo conflicts**: Advise users to refresh builder state and retry; if systemic, investigate node mutation patterns or recent deployments affecting validation/hashes.

## Verification Steps

- Re-run the affected API call with expected inputs; confirm HTTP status matches intended state.
- Check metrics logs (`[ai-metric]` / `[ai-alert]`) for the workspaceId and reason to ensure signals are flowing.
- Confirm audit rows appear for denials/undos with correct `wasDenied`, `reason`, and `integrityHash`.

## Escalation

- Primary: On-call backend engineer.
- Secondary: Security/compliance contact for SOC controls.
- If customer-impacting and persistent (>15 minutes), follow incident process (create incident ticket, post in #incidents, update status page per comms SOP).

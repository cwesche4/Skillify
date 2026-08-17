# AI Governance Tabletop Exercises

Use these scenarios to rehearse incident handling. No automation is included—follow playbook steps manually.

## Scenario 1: Global AI Actions Disabled

- **Trigger**: `AI_ACTIONS_GLOBALLY_DISABLED=true` set accidentally during deployment.
- **Expected signals**: AI endpoints return `503` with global disable message; metrics show `ai_action_denied` with reason `ai_actions_disabled`; no workspace-level toggles fix it.
- **Response**: Confirm intent with on-call lead; unset env and redeploy/restart per release process; notify affected teams; monitor metrics returning to normal.
- **Post-incident questions**: How was the env set? Was change control followed? Do alerts need tuning for global disablement?

## Scenario 2: Rate-Limit Abuse from One Workspace

- **Trigger**: A script or misconfigured integration floods AI actions for a single workspace.
- **Expected signals**: Frequent `429` responses with `retryAfterMs`; metrics `ai_action_rate_limited`; alerts `rate_limit_spike` for that workspace.
- **Response**: Identify workspaceId from metrics; contact workspace admin; request throttling/rollback; consider temporary plan controls; verify rate-limit alerts subside.
- **Post-incident questions**: Were limits sufficient? Should thresholds be adjusted? Did communication reach the right contact promptly?

## Scenario 3: Audit Tamper Suspicion

- **Trigger**: An auditor suspects audit records were altered.
- **Expected signals**: Audit CSV export shows `integrityHash` chain; no delete/update paths; metrics/alerts normal.
- **Response**: Export audits via `GET /api/workspaces/{id}/ai-actions/audit/export`; validate footer metadata and integrity hash presence; compare hashes across consecutive records; confirm append-only behavior.
- **Post-incident questions**: Are integrity checks documented clearly? Do auditors have self-serve guidance? Do we need automated hash verification tooling?

# SOC 2 AI Governance Walkthrough Script

Use this script during a live audit call. Follow the steps; do not improvise beyond what is documented.

## 1) Opening Context

- Scope: AI actions within the automation builder. Governance includes kill switches, rate limits, audits with integrity hashes, undo conflict protection, and exportable evidence.
- Demonstrate: Kill switches, rate limiting, audit creation, undo conflict handling, evidence retrieval, integrity verification, and monitoring signals.

## 2) Control Demonstrations

- **Kill switches**: Explain global env `AI_ACTIONS_GLOBALLY_DISABLED` and workspace toggle (`aiActionsEnabled`). Show a call to `/api/workspaces/{workspaceId}/settings/ai-actions` (GET) to confirm state. Optionally toggle via PUT if in a safe environment and show AI endpoint returns 403/503 when disabled.
- **Rate limiting**: Call `/api/ai/node-improve` repeatedly for the same workspace until a `429` with `retryAfterMs` is returned. Confirm this is server-enforced (no client logic).
- **Audit log creation**: Perform a successful AI action (e.g., node-improve) and note that an audit row will be written (`AiActionAudit`).
- **Undo conflict handling**: Call `/api/workspaces/{workspaceId}/ai-actions/undo` with a mismatched `currentNodeData` to produce `409 Conflict`.

## 3) Evidence Retrieval

- **Audit CSV export**: Call `/api/workspaces/{workspaceId}/ai-actions/audit/export` with a small filter window; download CSV and point out headers + footer metadata.
- **Evidence bundle ZIP**: Call `/api/workspaces/{workspaceId}/ai-actions/evidence` (optional filters) and show contents (audit.csv, control-registry.json, runbook references).
- **Governance status**: Call `/api/internal/governance/status` to show last audit/rate-limit/alert timestamps (read-only).

## 4) Integrity Verification

- Explain `integrityHash` stored on each `AiActionAudit` row (computed at insert time with previous hash).
- Confirm append-only behavior: schema has no update/delete flows for `AiActionAudit`.
- Show undo chaining via `undoOfId` linking undo entries to original actions.

## 5) Monitoring & Alerts

- Metrics: Mention structured `[ai-metric]` logs emitted from `lib/observability/aiMetrics.ts` for attempted/applied/denied/undone/rate-limited events.
- Alerts: Mention threshold-based `[ai-alert]` logs from `lib/observability/aiAlerts.ts` for denial spikes, rate-limit spikes, and undo conflicts; thresholds are documented in that file.
- Incident signals: Note that these logs are workspace-scoped and payload-free.

## 6) Close-Out

- Self-serve evidence: Audit/export endpoints and evidence bundle; readiness packet `docs/compliance/soc2-ai-governance-readiness.md`.
- Documentation references: Runbook `docs/runbooks/ai-actions.md`, tabletop `docs/incidents/ai-governance-tabletop.md`, control registry `lib/compliance/controlRegistry.ts`, trust brief `docs/sales/ai-governance-trust-brief.md`.

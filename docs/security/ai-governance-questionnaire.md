# AI Governance Security Questionnaire (Auto-Answers)

## 1) AI Usage & Scope

- **How AI is used:** AI assists with configuring automation nodes and providing suggestions; actions are executed server-side and tied to a workspace/user.
- **What AI can do:** Suggest and apply node configuration changes when enabled and permitted.
- **What AI cannot do:** Cannot bypass server controls, cannot run if global or workspace kill switch is disabled, cannot operate outside the requesting workspace.

## 2) Access Controls

- **Role enforcement:** Workspace membership/admin checks are enforced on AI routes (e.g., settings updates, audits).
- **Workspace isolation:** AI actions are scoped to the provided workspaceId; settings and audits are per-workspace.
- **Kill switches:** Global env kill switch (`AI_ACTIONS_GLOBALLY_DISABLED`) and workspace setting (`aiActionsEnabled`) are enforced server-side via `assertAiActionsEnabled`.

## 3) Change Control

- **Undo protections:** Undo endpoint validates snapshot hashes and rejects on conflicts (409) via `undoAiAction`.
- **Conflict handling:** Undo conflict detection prevents applying stale state; conflicts are audited with reasons.
- **Audit chaining:** `AiActionAudit` includes `undoOfId` and `integrityHash` to chain and validate actions.

## 4) Logging & Auditability

- **What is logged:** AI actions (and denials) with before/after snapshots, reasons, and actor/workspace IDs in `AiActionAudit`.
- **Integrity protection:** Integrity hashes computed at insert time; append-only model (no updates/deletes).
- **Export capabilities:** Server-generated CSV via `/api/workspaces/{workspaceId}/ai-actions/audit/export` with footer metadata; ZIP evidence bundle available.

## 5) Monitoring & Detection

- **Metrics collected:** Structured metrics for attempted/applied/denied/undone/rate-limited events (`lib/observability/aiMetrics.ts`).
- **Alerts triggered:** Threshold-based alerts for denial spikes, rate-limit spikes, and undo conflicts (`lib/observability/aiAlerts.ts`).
- **Abuse detection approach:** Threshold (non-ML) checks only; no payload contents in metrics/alerts.

## 6) Incident Response

- **Detection:** Alerts and metrics surface abnormal patterns; readiness/status endpoints support checks.
- **Disablement:** AI can be disabled globally via env or per-workspace via settings (kill switch).
- **Runbooks:** Incident steps documented in `docs/runbooks/ai-actions.md`; tabletop exercises in `docs/incidents/ai-governance-tabletop.md`.

## 7) Privacy & Data Handling

- **Payload handling:** Metrics/alerts exclude payload contents; audits store node snapshots for governance, not PII processing.
- **PII handling:** No PII is included in metrics/alerts; audits store only what is provided in node data for governance.
- **Redaction:** Metrics and alerts are structured and omit payload content by design; governance logs are for accountability, not analytics.

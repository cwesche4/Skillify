# SOC 2 – AI Governance Evidence Walkthrough

This guide maps existing controls to their enforcement points and shows how an auditor can independently verify them. No new controls are introduced here.

## Controls & Enforcement

- **CC6.1 — Workspace AI kill switch**
  - Enforcement: `lib/builder/ai/server/assertAiActionsEnabled.ts` (global and workspace checks).
  - Evidence: `WorkspaceSettings.aiActionsEnabled` (Prisma), API `GET /api/workspaces/{id}/settings/ai-actions`.

- **CC7.2 — Rate limiting**
  - Enforcement: `lib/rate-limit/aiActions.ts`.
  - Evidence: Responses `429` with `retryAfterMs`; metrics `ai_action_rate_limited`.

- **CC8.1 — Audit immutability + integrity**
  - Enforcement: `prisma/schema.prisma` (AiActionAudit.integrityHash, append-only), `lib/builder/ai/server/audit.ts`.
  - Evidence: `AiActionAudit` rows with `integrityHash`, `undoOfId`; no update/delete paths.

- **CC9.1 — Audit visibility/export**
  - Enforcement: `app/api/workspaces/[workspaceId]/ai-actions/audit/route.ts` (filtered query), `.../audit/export/route.ts` (CSV with footer metadata).
  - Evidence: CSV download includes headers + footer (`GeneratedAt`, `WorkspaceId`, `ExportedBy`).

- **CC7.3 — Abnormal usage alerts**
  - Enforcement: `lib/observability/aiAlerts.ts` (denial/rate-limit/undo-conflict spikes), `lib/observability/aiMetrics.ts` (structured metrics).
  - Evidence: Alert logs `[ai-alert]` and metric logs `[ai-metric]` in server logs for affected workspaceId.

## How to Generate Proof

1. **Export audit records**
   - Call `GET /api/workspaces/{workspaceId}/ai-actions/audit/export` with filters (from/to/actorUserId/action/nodeId/automationId/wasDenied).
   - Result: UTF-8 CSV with required columns + footer metadata.

2. **Query filtered audits (read-only)**
   - Call `GET /api/workspaces/{workspaceId}/ai-actions/audit` with the same filters.
   - Confirm rows include `integrityHash`, `wasDenied`, `reason`, timestamps.

3. **Validate kill switch**
   - Call `GET /api/workspaces/{workspaceId}/settings/ai-actions` to see current flag.
   - Toggle via `PUT .../ai-actions` (admin-only) and re-check; audit denials should appear when disabled.

4. **Validate rate limiting**
   - Repeatedly POST `/api/ai/node-improve` for a workspace until `429` is returned; confirm `retryAfterMs` and that metrics/alerts log entries appear.

5. **Validate undo conflict handling**
   - Trigger `/api/workspaces/{workspaceId}/ai-actions/undo` with mismatched `currentNodeData` to elicit `409`; confirm alert/metric logged and audit row `reason=conflict_detected`.

## Evidence Locations

- Database: `AiActionAudit` table (Prisma model) for all AI action events, integrity hashes, and undo links.
- APIs: Audit query and export routes, workspace settings route, node-improve, undo.
- Logs: `[ai-metric]` and `[ai-alert]` console outputs (structured JSON) for operational signals.

## Notes

- All controls are server-enforced; no client trust or client-side filtering.
- Exports are immutable snapshots with footer metadata for chain-of-custody context.
- No PII or payload contents are emitted in metrics/alerts per policy.

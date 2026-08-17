# SOC 2 Readiness Packet — AI Governance

This packet provides auditors with a self-contained view of AI governance controls, evidence, and how to verify them. No new controls are introduced here.

## 1) System Overview

- **What it does:** Governs AI-assisted actions in the automation builder. Enforces workspace/global kill switches, rate limits, audits (with integrity hashes), undo conflict protection, and exportable evidence.
- **What it does not do:** No client-side enforcement; no payload contents in metrics/alerts; no auto-remediation or user blocking beyond configured rate limits and kill switches.

## 2) Control Mapping

- **CC6 (Access/Kill Switch)**: Workspace/global AI kill switch enforced in `lib/builder/ai/server/assertAiActionsEnabled.ts`; setting stored in `WorkspaceSettings.aiActionsEnabled`; UI at `app/dashboard/[workspaceSlug]/settings/ai-actions/page.tsx`.
- **CC7 (Change/Incident Detection)**: Rate limiting in `lib/rate-limit/aiActions.ts`; alerts in `lib/observability/aiAlerts.ts`; metrics in `lib/observability/aiMetrics.ts`; startup safety in `lib/startup/aiSafetyCheck.ts`.
- **CC8 (Integrity/Audit)**: Append-only `AiActionAudit` with `integrityHash` (see `prisma/schema.prisma` and `lib/builder/ai/server/audit.ts`); undo conflict detection in `lib/builder/ai/server/undo.ts`.
- **CC9 (Data/Reporting)**: Server-filtered audit query/export endpoints `app/api/workspaces/[workspaceId]/ai-actions/audit/route.ts` and `.../audit/export/route.ts`; evidence bundle `.../ai-actions/evidence/route.ts`.

## 3) Evidence Index

- **Audit logs**: Table `AiActionAudit` (Prisma schema) with `integrityHash`, `undoOfId`, `wasDenied`, `reason`.
- **Exports**: CSV via `GET /api/workspaces/{workspaceId}/ai-actions/audit/export` (headers + footer metadata); bundled ZIP via `.../ai-actions/evidence/route.ts`.
- **Metrics & alerts**: Structured logs from `lib/observability/aiMetrics.ts` (`[ai-metric]`) and `lib/observability/aiAlerts.ts` (`[ai-alert]`).
- **Runbooks/Tabletops**: `docs/runbooks/ai-actions.md`; tabletop exercises at `docs/incidents/ai-governance-tabletop.md`.
- **Self-audit & status**: Read-only checks in `lib/governance/selfAudit.ts`; governance status endpoint `app/api/internal/governance/status/route.ts`.
- **Control registry**: `lib/compliance/controlRegistry.ts` enumerates enforcement locations.

## 4) Operational Safeguards

- **Kill switches**: Global env `AI_ACTIONS_GLOBALLY_DISABLED`; workspace-level setting `aiActionsEnabled`; enforced by `assertAiActionsEnabled`.
- **Rate limiting**: Workspace+user scoped limiter in `lib/rate-limit/aiActions.ts`; 429 with `retryAfterMs`; metrics/alerts emitted.
- **Undo conflict protection**: `lib/builder/ai/server/undo.ts` rejects with 409 when snapshots diverge; audits chained via `undoOfId`.
- **Startup safety**: `lib/startup/aiSafetyCheck.ts` fails fast if env/table/rate-limit readiness is missing.

## 5) Audit Execution Guide

1. **Export evidence**: Call `GET /api/workspaces/{workspaceId}/ai-actions/evidence` (optional filters) to download ZIP containing audit CSV, control registry, and references. Alternatively, use `.../audit/export` for CSV only.
2. **Validate integrity**: Inspect CSV rows for `integrityHash` (from `AiActionAudit`), footer metadata (`GeneratedAt`, `WorkspaceId`, `ExportedBy`). Optionally cross-check consecutive hashes in DB (`AiActionAudit`).
3. **Confirm controls**:
   - Kill switches: `GET /api/workspaces/{workspaceId}/settings/ai-actions`; set `AI_ACTIONS_GLOBALLY_DISABLED=true` to observe 503 (if safe in a non-prod environment).
   - Rate limit: POST `/api/ai/node-improve` repeatedly until 429; verify `retryAfterMs` and `[ai-alert] rate_limit_spike` logs.
   - Undo conflicts: Call `/api/workspaces/{workspaceId}/ai-actions/undo` with mismatched `currentNodeData` to elicit 409; confirm audit `reason=conflict_detected`.
4. **Review alerts/incidents**: Check server logs for `[ai-metric]` and `[ai-alert]` entries keyed by workspaceId; follow runbook `docs/runbooks/ai-actions.md`.
5. **Self-audit/status**: Run `runGovernanceSelfAudit` (read-only) or call `GET /api/internal/governance/status` to see last audit/rate-limit/alert timestamps.

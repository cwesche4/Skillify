# AI Governance GRC Review Checklist

Use this checklist to verify implemented controls. Each item is verifiable via referenced files or endpoints and can be marked Pass/Fail.

## 1) Governance & Oversight

- ☐ Kill switches present (global env `AI_ACTIONS_GLOBALLY_DISABLED`, workspace setting via `lib/builder/ai/server/assertAiActionsEnabled.ts`)
- ☐ Admin access enforced on settings (`app/api/workspaces/[workspaceId]/settings/ai-actions/route.ts`)
- ☐ Control registry documented (`lib/compliance/controlRegistry.ts`)

## 2) Access & Abuse Controls

- ☐ Rate limiting implemented (`lib/rate-limit/aiActions.ts`)
- ☐ Denial handling returns 403/503 with reasons (`lib/builder/ai/server/assertAiActionsEnabled.ts`, `app/api/ai/node-improve/route.ts`)
- ☐ Workspace isolation enforced on AI routes (workspaceId required in AI endpoints)

## 3) Audit & Integrity

- ☐ Append-only AI audits (`prisma/schema.prisma` model `AiActionAudit`)
- ☐ Integrity hashing on inserts (`lib/builder/ai/server/audit.ts`)
- ☐ Undo chaining with conflict checks (`lib/builder/ai/server/undo.ts`)

## 4) Monitoring & Detection

- ☐ Metrics emitted for AI actions (`lib/observability/aiMetrics.ts`)
- ☐ Alerts defined for denials/rate limits/undo conflicts (`lib/observability/aiAlerts.ts`)
- ☐ Thresholds documented in alerts module (`lib/observability/aiAlerts.ts`)

## 5) Incident Readiness

- ☐ Runbooks available (`docs/runbooks/ai-actions.md`)
- ☐ Tabletop exercises documented (`docs/incidents/ai-governance-tabletop.md`)
- ☐ Disablement paths verified (global env + workspace toggle endpoints)

## 6) Evidence Availability

- ☐ CSV export endpoint (`app/api/workspaces/[workspaceId]/ai-actions/audit/export/route.ts`)
- ☐ Evidence bundle ZIP endpoint (`app/api/workspaces/[workspaceId]/ai-actions/evidence/route.ts`)
- ☐ Status/self-audit endpoints (`app/api/internal/governance/status/route.ts`, `lib/governance/selfAudit.ts`)

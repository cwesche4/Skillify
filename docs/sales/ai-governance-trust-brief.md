# AI Governance Trust Brief (Enterprise)

## Executive Summary

Our AI assists teams with configuring automation steps inside their workspaces. Every AI action is server-controlled, workspace-scoped, and can be shut off instantly. Audits, rate limits, and undo safeguards ensure AI changes stay accountable and reversible. Enterprises can trust that AI behavior is governed, observable, and provable—without relying on client-side controls.

## Key Trust Pillars

- **Kill switches (global + workspace):** Operators can pause all AI activity platform-wide, and workspace admins can disable AI actions locally. AI routes return explicit errors when disabled.
- **Auditability & integrity:** Every AI action or denial is recorded with before/after snapshots and integrity hashes for tamper detection. Audits are exportable as immutable CSVs with metadata.
- **Abuse prevention & alerts:** Workspace-scoped rate limits and denial/undo-conflict alerts surface abnormal patterns early—without inspecting payload contents.
- **Incident readiness:** Runbooks and tabletop exercises outline how to respond to global disables, rate-limit spikes, or audit concerns; AI can be halted instantly if needed.

## What This Means for Buyers

- **Risk reduction:** Immediate kill switches and rate limits minimize blast radius.
- **Audit readiness:** Exportable audits and integrity hashes provide defensible evidence for reviews.
- **Operational safety:** Undo protections, conflict checks, and alerts keep AI changes controlled and observable.

## Evidence References

- SOC-2 readiness packet: `docs/compliance/soc2-ai-governance-readiness.md`
- Audit exports: `GET /api/workspaces/{workspaceId}/ai-actions/audit/export` (CSV) and evidence bundle endpoint.
- Runbooks & tabletops: `docs/runbooks/ai-actions.md`, `docs/incidents/ai-governance-tabletop.md`

# AI Governance Evidence Bundles (Sales-Ready)

Standardized bundles for procurement and security reviews. No new data is created; bundles reuse existing artifacts.

## 1) AI Governance Evidence Bundle

- **Use case:** AI governance review, procurement security questionnaires.
- **Included artifacts:** Audit CSV and control registry via `/api/workspaces/{workspaceId}/ai-actions/evidence`; references to runbook (`docs/runbooks/ai-actions.md`) and trust brief (`docs/sales/ai-governance-trust-brief.md`).
- **How generated:** Call the evidence endpoint with optional filters; bundle returns ZIP.
- **Answers:** How AI actions are logged, how controls map to code, where runbooks live.
- **Sharing:** Safe to share under NDA; contains audit data for the requester’s workspace.

## 2) SOC-2 AI Controls Bundle

- **Use case:** Auditor/GRC requests for SOC-2 control verification.
- **Included artifacts:** SOC-2 readiness packet (`docs/compliance/soc2-ai-governance-readiness.md`), control registry (`lib/compliance/controlRegistry.ts`), walkthrough script (`docs/compliance/soc2-ai-governance-walkthrough.md`), Vanta/Drata mapping (`docs/compliance/vanta-drata-ai-governance-mapping.md`).
- **How generated:** Provide documents as a set (no new export).
- **Answers:** Which controls exist, where enforced, how to verify during audits.
- **Sharing:** Public docs are safe; share registry/mapping under NDA as needed.

## 3) Incident Readiness Bundle

- **Use case:** Demonstrate response capability for AI-related incidents.
- **Included artifacts:** Runbook (`docs/runbooks/ai-actions.md`), tabletop exercises (`docs/incidents/ai-governance-tabletop.md`), customer AI security overview (`docs/security/customer-ai-security.md`), trust center AI governance page (`docs/trust/trust-center-ai-governance.md`).
- **How generated:** Provide docs as a set; no exports.
- **Answers:** How incidents are detected/handled, disablement paths, customer comms posture.
- **Sharing:** Safe to share publicly; confirm NDA if including customer-specific details.

## 4) Audit & Integrity Bundle

- **Use case:** Prove tamper resistance and audit transparency.
- **Included artifacts:** Audit CSV export endpoint (`/api/workspaces/{workspaceId}/ai-actions/audit/export`), evidence ZIP endpoint, audit integrity description (`docs/compliance/soc2-ai-governance-readiness.md` integrity section), undo/conflict protections (`lib/builder/ai/server/undo.ts` reference).
- **How generated:** Export CSV/evidence ZIP for the requesting workspace; share supporting docs.
- **Answers:** How audits are chained, how integrity hashes work, how undo conflicts are handled, how to export evidence.
- **Sharing:** CSV/ZIP are workspace-specific—share under NDA; docs can be public.

## Mapping to Common Buyer Questions

- “Can we disable AI quickly?” → Kill switches described in trust brief/readiness packet.
- “Is AI auditable?” → Audit CSV/evidence bundle, integrity hash description.
- “How do you prevent abuse?” → Rate limits/alerts in readiness packet and trust pages.
- “How do you handle incidents?” → Runbook/tabletop docs and disablement paths.

## Public vs. NDA Notes

- Public: Trust pages, customer AI security overview, governance summary, incident readiness docs.
- NDA/Per-request: Workspace-specific audit exports/ZIP, control registry/mapping if needed for detailed reviews.

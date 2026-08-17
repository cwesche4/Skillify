# AI Governance RFP / SIG Lite / CAIQ Pre-Answers

Plain, reusable responses for security questionnaires. Reflects implemented controls only.

## 1) AI Usage & Scope

- **How is AI used?** AI assists with configuring automation nodes and suggestions within each workspace. Actions are server-side and tied to workspace/user context.
- **What is out of scope?** AI cannot run outside the requesting workspace, cannot bypass server controls, and does not inspect payload contents in metrics/alerts.

## 2) Access Controls & Isolation

- **How is access enforced?** AI endpoints require workspace context and membership/admin checks as applicable; actions are workspace-scoped.
- **Is data isolated?** Yes. AI actions and audits are bound to the workspaceId provided in the request.

## 3) AI Kill Switches

- **Are there kill switches?** Yes. Platform-wide disablement via environment control and per-workspace AI toggle. When disabled, AI endpoints return explicit errors and take no action.
- **Where documented?** Trust and readiness docs (AI governance summary, SOC-2 readiness packet).

## 4) Audit Logging & Integrity

- **What is logged?** AI actions and denials with before/after snapshots, reasons, actor/workspace IDs.
- **Integrity protections?** Audit entries include integrity hashes and are append-only; undo links are chained via undoOfId.
- **Exports?** CSV export and evidence bundle endpoints provide immutable snapshots with metadata.

## 5) Monitoring & Abuse Detection

- **Metrics collected?** Structured metrics for attempted/applied/denied/undone/rate-limited events (no payload contents).
- **Alerts?** Threshold-based alerts for denial spikes, rate-limit spikes, and undo conflicts.
- **Abuse approach?** Threshold checks only; no ML or payload inspection.

## 6) Incident Response & Disablement

- **How are incidents handled?** Runbooks and tabletop exercises cover global/ workspace disablement, rate-limit spikes, and audit reviews. AI can be halted instantly via global env or workspace toggle.
- **Where documented?** AI actions runbook, tabletop exercises, readiness packet.

## 7) Compliance Alignment (SOC-2 context)

- **Alignment statement:** Controls support SOC-2 readiness for AI governance (kill switches, audits with integrity, rate limits, alerts, evidence exports).
- **Evidence:** SOC-2 AI governance readiness packet, auditor walkthrough, control registry, Vanta/Drata mapping.

## 8) Customer Controls & Transparency

- **Customer controls:** Workspace AI enable/disable, audit export, ability to work with support on rate-limit/alert issues.
- **Transparency:** Trust center content, customer AI security overview, evidence bundles available on request.

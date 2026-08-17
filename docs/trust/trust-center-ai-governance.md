# Trust Center: AI Governance

## 1) AI Governance Overview

- **What AI is used for:** AI assists with configuring automation steps and suggestions inside each workspace.
- **How AI actions are controlled:** All AI actions are server-enforced, workspace-scoped, and subject to kill switches, audits, and rate limits.
- **When AI is disabled:** AI endpoints return explicit errors and take no action; workspace kill switch and a platform-wide switch allow immediate shutdown.

## 2) Security & Control Mechanisms

- **Kill switches:** Platform-wide disablement via environment control and per-workspace AI toggle; both are enforced before any action runs.
- **Audit logging & integrity:** Every AI action or denial is logged with before/after snapshots and integrity hashes to detect tampering; logs are append-only and exportable.
- **Rate limiting & abuse detection:** Workspace/user rate limits and denial/undo-conflict alerts surface abnormal patterns early, without inspecting payload contents.
- **Undo & conflict protections:** Undo requests verify state and refuse changes when conflicts are detected, maintaining audit links between actions.

## 3) Monitoring & Incident Readiness

- **Metrics & alerts:** Structured metrics and threshold-based alerts highlight spikes in denials, rate limits, or undo conflicts.
- **Incident response readiness:** Runbooks and tabletop exercises guide operators; AI can be halted instantly at workspace or platform level if needed.
- **Operator controls:** Administrators can view settings, audits, and exports; platform operators can enforce global disablement.

## 4) Audit & Compliance Transparency

- **Audit exports:** CSV exports and an evidence bundle provide immutable snapshots with metadata for review.
- **Evidence bundles:** Consolidated ZIP includes audit CSV, control registry, and references to runbooks/compliance docs.
- **SOC-2 readiness posture:** SOC-2 AI governance readiness and walkthrough documents are available for auditors.

## 5) Customer Assurance Statements

- **Server-side enforcement:** Controls (kill switches, rate limits, audits) are enforced on the server; UI reflects server truth.
- **No payload inspection in metrics/alerts:** Metrics and alerts exclude payload contents and PII by design.
- **Workspace isolation:** AI actions and governance are scoped to the requesting workspace; data is not shared across workspaces.

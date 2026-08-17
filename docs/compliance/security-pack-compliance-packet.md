# Security Pack — Compliance & Governance Overview

Version: v1.0 • Date: 2024-06-01 • Audience: Auditors / Enterprise Security

## Table of Contents

1. Cover Page
2. Executive Summary
3. System Architecture Overview
4. Control Narratives (SOC 2 CC6/CC7/CC7.2/CC7.3)
5. Evidence Index
6. Entitlement & Contract Governance
7. Operational Safeguards
8. Transparency & Exports
9. Delay Disclaimer
10. Appendix (API inventory, glossary)

---

## 1) Cover Page

Title: “Security Pack — Compliance & Governance Overview”  
Version: v1.0 • Date: 2024-06-01 • Audience: Auditors / Enterprise Security

## 2) Executive Summary (Pull from executive overview)

- See `docs/exec/security-pack-system-overview.md` for guarantees, non-guarantees, and control ownership.
- Key guarantees: entitlement-enforced access, append-only audits, 404 concealment for unauthorized/undelivered access, no payload storage.
- Explicit non-guarantees: no delivery SLAs, no guaranteed approvals, no certification guarantees, no self-service activation.

## 3) System Architecture Overview

- One-page diagram and explanation: `docs/exec/security-pack-system-overview.md`.
- Highlights: contract entitlements → resolver → API enforcement → append-only audit → optional automation/CRM hooks.

## 4) Control Narratives (SOC 2)

- Narrative: `docs/compliance/security-pack-soc2-narrative.md` (CC6, CC7, CC7.2, CC7.3 coverage).
- Plain English, no code references.

## 5) Evidence Index

- Control → evidence mapping: `docs/compliance/security-pack-soc2-evidence-index.md`.
- Auditor walkthrough steps included (requests, approvals, audit immutability, downloads, entitlements, disclaimer).

## 6) Entitlement & Contract Governance

- Contract packaging spec: `docs/enterprise/security-pack-contract-packaging.md`.
- Entitlement enforcement: `docs/security-pack/entitlement-enforcement-final.md`.
- Entitlement audit log (append-only, contract-level): `docs/enterprise/entitlement-audit-log.md`.
- Regulated templates: `docs/enterprise/regulated-customer-templates.md` (guidance only).

## 7) Operational Safeguards

- Approval inbox (reviewer-gated): `docs/ui/internal-security-pack-approval-inbox.md`.
- Automation service tokens (scope-based, constant-time verification).
- Delivery idempotency: delivery callbacks are single-write; retries are no-ops after success.
- 404 concealment: download/artifact routes return 404 for unauthorized or undelivered states.

## 8) Transparency & Exports

- Entitlement preview (read-only): `GET /api/workspaces/:id/entitlements`.
- Entitlement history with CSV export: `GET /api/workspaces/:id/entitlements/history?format=csv`.
- Audit timelines: `GET /api/security-pack/request/:id` (read-only, append-only events).

## 9) Delay Disclaimer

- Timeline responses include: “Events are generated automatically and may be delayed during approval or delivery.” (No timing SLA implied.)

## 10) Appendix

- API inventory (read-only focus):
  - `GET /api/workspaces/:id/entitlements` (current entitlements)
  - `GET /api/workspaces/:id/entitlements/history` (history, CSV)
  - `GET /api/security-pack/request/:id` (timeline)
  - `GET /api/security-pack/audit` (workspace audit feed; admin + entitlement gated)
- Glossary (concise):
  - Entitlement: Contract-granted capability; enforced server-side.
  - Append-only audit: Audit records are never updated or deleted.
  - Concealment: Unauthorized/undelivered download access returns 404 to avoid existence leakage.
  - Service token: Scoped token for automation; compared in constant time; no user impersonation.

## Versioning Guidance

- Update version and date when any control, entitlement model, or API behavior changes.
- Maintain cross-references to underlying docs to keep Notion/PDF exports in sync.

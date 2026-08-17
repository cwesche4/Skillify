# Security Review Email Orchestration (Deterministic Spec)

This specification defines how to pick an industry template, attach evidence, and include Trust Center links for security/procurement reviews. No sending logic or new controls are included.

## 1) Industry Classification Input

- **Priority:** manual override > CRM industry field > deal type (enterprise/regulated) > default (B2B SaaS).
- **Allowed values:** Fintech/Financial Services, Healthcare/HealthTech, B2B SaaS, Large Enterprise/Regulated, Public Sector/Education.
- **Fallback:** If unknown after priority checks, use B2B SaaS.

## 2) Template Selection Logic

- **Mapping:**
  - Fintech → `docs/sales/security-review-email-fintech.md`
  - Healthcare → `docs/sales/security-review-email-healthcare.md`
  - B2B SaaS → `docs/sales/security-review-email-saas.md`
  - Large Enterprise/Regulated → `docs/sales/security-review-email-enterprise.md`
  - Public Sector/Education → `docs/sales/security-review-email-public-sector.md`
- **Rules:** One template per send; no mixing language; fallback to B2B SaaS template if industry unknown.

## 3) Evidence Attachment Rules

- **Default attach (all contexts):** Trust Center link; AI Governance Overview reference.
- **If “Evidence Requested”:** Include Evidence Bundle (ZIP) and Audit CSV Export (workspace-scoped). Mark as NDA-only and workspace-scoped.
- **If “SOC-2 / GRC Escalation”:** Include SOC-2 Readiness Packet, Control Mapping (Vanta/Drata), Auditor Walkthrough. Mark as NDA-only; static docs unless a workspace-specific export is requested.
- **Public vs NDA:** Trust Center links and overviews are public; bundles, exports, and SOC-2 packets are NDA/workspace-specific as applicable.

## 4) Trust Center Linking Rules

- Always include `/trust`.
- Add relevant deep links: `/trust/ai-governance`, `/trust/audit-and-evidence`, `/trust/compliance` based on context (governance, evidence, SOC-2).
- Links only; no attachments for Trust Center pages; use public URLs.

## 5) Output Contract

- **Template:** Selected template file reference (no content modification).
- **Artifacts:** List of attachments/links with flags: `ndaRequired`, `workspaceScoped`.
- **Trust links:** Ordered list of Trust Center URLs with labels.
- **Preview:** Human-reviewable assembled email (template + links + attachment list) before sending.

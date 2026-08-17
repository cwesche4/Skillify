# Trust Center Site Structure (AI Governance & Security)

Plain-language sitemap for a public Trust Center. References existing artifacts only; no new claims or technical deep dives.

## Overview (/trust)

- **Purpose:** High-level introduction to security and AI governance posture.
- **Topics:** Commitment to controlled AI actions, server-side enforcement, workspace isolation.
- **Links:** `docs/trust/ai-governance-summary.md`
- **Audience:** Buyers, security reviewers, auditors.
- **Public:** Yes.

## AI Governance (/trust/ai-governance)

- **Purpose:** Explain how AI is used and controlled.
- **Topics:** Workspace-scoped AI usage, kill switches, audits, rate limits.
- **Links:** `docs/trust/trust-center-ai-governance.md`, `docs/security/customer-ai-security.md`
- **Audience:** Buyers, admins, security reviewers.
- **Public:** Yes.

## Security Controls (/trust/security-controls)

- **Purpose:** Summarize control mechanisms without implementation detail.
- **Topics:** Kill switches, rate limiting, audit integrity, undo/conflict protections.
- **Links:** `docs/trust/ai-safety-overview.md`, `docs/security/ai-governance-questionnaire.md`
- **Audience:** Security teams, procurement.
- **Public:** Yes.

## Compliance & Certifications (/trust/compliance)

- **Purpose:** Show readiness artifacts and control mappings.
- **Topics:** SOC-2 readiness packet, control registry, Vanta/Drata mapping.
- **Links:** `docs/compliance/soc2-ai-governance-readiness.md`, `docs/compliance/controlRegistry.ts`, `docs/compliance/vanta-drata-ai-governance-mapping.md`
- **Audience:** Auditors, GRC teams.
- **Public:** Yes; some detailed evidence on request.

## Audit & Transparency (/trust/audit)

- **Purpose:** Explain audit exports and evidence access.
- **Topics:** Audit CSV export, evidence bundle, integrity hashes, append-only logs.
- **Links:** `docs/compliance/soc2-ai-governance-readiness.md`, `docs/trust/ai-safety-overview.md`
- **Audience:** Auditors, admins.
- **Public:** Yes; endpoints usage guidance available on request.

## Incident Response (/trust/incident-response)

- **Purpose:** Describe readiness and response playbooks.
- **Topics:** Runbooks, tabletop exercises, disablement paths.
- **Links:** `docs/runbooks/ai-actions.md`, `docs/incidents/ai-governance-tabletop.md`
- **Audience:** Security/ops teams, admins.
- **Public:** Yes.

## Customer Controls (/trust/customer-controls)

- **Purpose:** Show what customers can configure.
- **Topics:** Workspace AI toggle, audit exports, working with support on rate limits/alerts.
- **Links:** `docs/security/customer-ai-security.md`, `docs/trust/ai-safety-overview.md`
- **Audience:** Admins, buyers.
- **Public:** Yes.

## Documentation & Evidence (/trust/docs)

- **Purpose:** Central index for deeper evidence requests.
- **Topics:** Readiness packet, walkthrough script, trust brief, procurement deck.
- **Links:** `docs/compliance/soc2-ai-governance-readiness.md`, `docs/compliance/soc2-ai-governance-walkthrough.md`, `docs/sales/ai-governance-trust-brief.md`, `docs/sales/ai-governance-procurement-deck.md`
- **Audience:** Auditors, procurement, security reviewers.
- **Public:** Yes; some evidence (e.g., exports) available on request.

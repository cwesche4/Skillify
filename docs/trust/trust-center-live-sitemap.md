# Trust Center Live Sitemap

Production-ready sitemap for a public Trust Center. All content references existing artifacts; no new claims are introduced.

## Navigation

- Top-level: /trust
- Subpages: /trust/ai-governance, /trust/security-controls, /trust/compliance, /trust/audit-and-evidence, /trust/incident-response, /trust/customer-controls, /trust/documentation

## Pages

### /trust

- **Title:** Trust
- **Description:** Landing page introducing security, compliance, and AI governance posture with links to detailed sections.
- **Audience:** Buyer, security, auditor, admin
- **Visibility:** Public
- **Linked artifacts:** Trust landing copy, trust brief, readiness packet (referenced)
- **Footer cross-links:** AI governance, audit & evidence, compliance, incident response

### /trust/ai-governance

- **Title:** AI Governance
- **Description:** How AI is used, governed, and disabled, including kill switches and audits.
- **Audience:** Buyer, security, admin
- **Visibility:** Public
- **Linked artifacts:** AI governance trust page, customer AI security overview, AI safety overview
- **Footer cross-links:** Audit & evidence, customer controls

### /trust/security-controls

- **Title:** Security Controls
- **Description:** Summary of operational safeguards: kill switches, rate limits, undo/conflict protections, monitoring.
- **Audience:** Security, auditor, buyer
- **Visibility:** Public
- **Linked artifacts:** AI safety overview, questionnaire answers, trust brief
- **Footer cross-links:** Compliance, incident response

### /trust/compliance

- **Title:** Compliance
- **Description:** SOC-2 readiness posture and control mappings.
- **Audience:** Auditor, GRC, procurement
- **Visibility:** Public (detailed evidence on request)
- **Linked artifacts:** SOC-2 AI governance readiness packet, control registry, Vanta/Drata mapping, auditor walkthrough
- **Footer cross-links:** Audit & evidence, documentation

### /trust/audit-and-evidence

- **Title:** Audit & Evidence
- **Description:** How to access audit exports and evidence bundles; notes on integrity and append-only logs.
- **Audience:** Auditor, admin, security
- **Visibility:** Public (exports require authentication)
- **Linked artifacts:** Audit export endpoint description, evidence bundle description, readiness packet
- **Footer cross-links:** Compliance, customer controls

### /trust/incident-response

- **Title:** Incident Response
- **Description:** Readiness posture for AI-related incidents, including disablement paths and procedures.
- **Audience:** Security, ops, admin
- **Visibility:** Public
- **Linked artifacts:** AI actions runbook, tabletop exercises, trust center incident notes
- **Footer cross-links:** Security controls, documentation

### /trust/customer-controls

- **Title:** Customer Controls
- **Description:** What customers can configure and review: workspace AI toggles, audit exports, support engagement for rate-limit/alert issues.
- **Audience:** Admin, buyer
- **Visibility:** Public
- **Linked artifacts:** Customer AI security overview, trust landing, evidence bundle info
- **Footer cross-links:** Audit & evidence, AI governance

### /trust/documentation

- **Title:** Documentation & Evidence
- **Description:** Index of public documents and how to request workspace-specific evidence.
- **Audience:** Auditor, procurement, security
- **Visibility:** Public (workspace exports on request/auth)
- **Linked artifacts:** SOC-2 readiness packet, trust brief, procurement deck, auditor walkthrough, evidence bundles overview
- **Footer cross-links:** Compliance, audit & evidence

## Implementation Notes

- Navigation: top-level Trust with subpages in nav; ensure consistent headers/footers linking related sections.
- Public vs request-only: Pages are public; workspace-specific exports/evidence are available on request/auth.
- CMS/static site: Each page should surface key artifacts via links or downloads where appropriate. Narrative content should remain plain and factual.

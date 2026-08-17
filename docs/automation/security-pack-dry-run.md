# Security Pack Dry Run — Fintech, SOC-2 Escalation

## Inputs

- Industry: Fintech
- Review type: SOC-2 escalation
- Workspace ID: [workspace-id]
- Recipient: Security team

## Execution Trace

1. **Industry classification:** Fintech (manual input) → template category: fintech.
2. **Template selected:** `docs/sales/security-review-email-fintech.md` (SOC-2 escalation context).
3. **Evidence bundles selected:**
   - SOC-2 AI Controls Bundle (NDA required; static docs)
   - AI Governance Evidence Bundle (NDA required; workspace-scoped if export included)
   - Audit CSV Export for workspace [workspace-id] (NDA required; workspace-scoped)
4. **Trust Center links attached:**
   - `/trust`
   - `/trust/compliance`
   - `/trust/audit-and-evidence`
   - `/trust/ai-governance`

## Email Preview (no modifications to template language)

**Subject:** SOC-2 evidence for AI governance controls  
**Body:**
Hi [Name],

Providing SOC-2–aligned materials for your risk committee review:

- SOC-2 Readiness Packet (AI governance)
- Evidence Bundle (audit CSV + control references)
- Trust Center (public posture)

Next steps: Let us know if you need a sample audit export or a brief walkthrough of disable/enable procedures.

Thank you, [Your Name]

## Attachments / Links

- Attachments (NDA):
  - SOC-2 AI Controls Bundle (static docs)
  - AI Governance Evidence Bundle (ZIP; workspace-aware)
  - Audit CSV Export (workspace [workspace-id])
- Trust Center links (public):
  - `/trust`
  - `/trust/compliance`
  - `/trust/audit-and-evidence`
  - `/trust/ai-governance`

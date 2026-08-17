# One-Click Security Pack Delivery (AI Governance)

Workflow specification to send a complete AI governance security packet using existing templates and evidence. No new controls or automation logic included.

## Inputs

- **Industry:** fintech, healthcare, saas, enterprise, public sector, bank/payments
- **Workspace identifier:** optional (for workspace-scoped exports)
- **Review type:** security review, SOC-2 escalation, audit request

## Automation Steps

1. **Select email template** based on industry:
   - fintech → `docs/sales/security-review-email-fintech.md`
   - healthcare → `docs/sales/security-review-email-healthcare.md`
   - saas → `docs/sales/security-review-email-saas.md`
   - enterprise → `docs/sales/security-review-email-enterprise.md`
   - public sector → `docs/sales/security-review-email-public-sector.md`
   - bank/payments → `docs/sales/security-review-email-bank-payments.md`
2. **Attach evidence bundle** based on review type:
   - security review / audit request → AI Governance Evidence Bundle + Audit CSV Export (workspace-scoped if provided)
   - SOC-2 escalation → SOC-2 AI Controls Bundle + AI Governance Evidence Bundle (mark as NDA)
   - incident request → Incident Readiness Bundle (runbooks/tabletops) + AI Governance Evidence Bundle
3. **Include Trust Center links**:
   - Always include `/trust`
   - Add relevant: `/trust/ai-governance`, `/trust/audit-and-evidence`, `/trust/compliance` (for SOC-2)
4. **Include SOC-2 readiness packet** when review type is SOC-2 escalation.
5. **Log delivery metadata**: date/time, recipient, industry, review type, bundle(s) attached, workspaceId (if used).

## Outputs

- **Email body:** Selected template content (no modification).
- **Artifacts:** List of attachments (evidence bundles, audit CSV if workspace provided, SOC-2 packet when applicable) with `ndaRequired` and `workspaceScoped` flags.
- **Trust Center links:** Included URLs.
- **Preview:** Human-reviewable package before sending; no auto-send.

## Mapping Table (Industry → Template → Bundles)

- Fintech → fintech template → AI Governance Evidence Bundle (+ Audit CSV if workspace provided); SOC-2 escalation adds SOC-2 AI Controls Bundle.
- Healthcare → healthcare template → AI Governance Evidence Bundle (+ Audit CSV); SOC-2 escalation adds SOC-2 AI Controls Bundle.
- B2B SaaS → saas template → AI Governance Evidence Bundle (+ Audit CSV); SOC-2 escalation adds SOC-2 AI Controls Bundle.
- Enterprise/Regulated → enterprise template → AI Governance Evidence Bundle (+ Audit CSV); SOC-2 escalation adds SOC-2 AI Controls Bundle.
- Public Sector/Education → public sector template → AI Governance Evidence Bundle (+ Audit CSV); SOC-2 escalation adds SOC-2 AI Controls Bundle.
- Bank/Payments → bank/payments template → AI Governance Evidence Bundle (+ Audit CSV); SOC-2 escalation adds SOC-2 AI Controls Bundle.

## Notes on Execution

- **Manual vs automated:** Workflow can be executed manually or by CRM/automation; always surface a preview for human review.
- **Trust Center links:** Only public URLs; no attachments for Trust pages.
- **NDA handling:** Mark workspace-specific exports and evidence bundles as NDA-only; do not auto-attach without confirmation.
- **Logging:** Capture delivery metadata in CRM or workflow log for auditability.

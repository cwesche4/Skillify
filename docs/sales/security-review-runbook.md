# Internal Sales Runbook — Security Reviews (AI Governance)

Purpose: Provide a consistent decision path for security reviews. Do not improvise beyond the approved templates and evidence.

## Step 1: Identify Industry & Review Type

- Determine industry (fintech, healthcare, saas, enterprise, public sector, bank/payments).
- Determine review type: security review, SOC-2 escalation, or audit request.
- If unclear, default to saas and ask Security/GRC.

## Step 2: Pick the Email Template

- Use the industry-specific template:
  - fintech → `security-review-email-fintech.md`
  - healthcare → `security-review-email-healthcare.md`
  - saas → `security-review-email-saas.md`
  - enterprise → `security-review-email-enterprise.md`
  - public sector → `security-review-email-public-sector.md`
  - bank/payments → `security-review-email-bank-payments.md`
- Do not mix language across templates.

## Step 3: Choose Evidence Bundle

- Security review / audit request: AI Governance Evidence Bundle + Audit CSV (workspace-scoped if provided).
- SOC-2 escalation: SOC-2 AI Controls Bundle + AI Governance Evidence Bundle (mark NDA).
- Incident-related: Incident Readiness Bundle + AI Governance Evidence Bundle.
- If workspace exports are requested, confirm workspace ID and NDA.

## Step 4: Attach Trust Links

- Always include `/trust`.
- Add relevant deep links:
  - AI governance questions → `/trust/ai-governance`
  - Evidence/questions → `/trust/audit-and-evidence`
  - SOC-2/GRC → `/trust/compliance`

## Step 5: When to Escalate

- SOC-2 escalations or any NDA evidence → involve Security/GRC (and Legal for NDA).
- If unsure about industry or scope → ask Security/GRC before sending.
- If a customer requests non-standard evidence → stop and consult Security/GRC.

## Step 6: Approval & Preview

- Present a preview of the email, attachments, and links.
- Confirm NDA status for workspace exports/bundles.
- No send without required approvals per the Security Pack Approval Policy.

## Step 7: Log the Send

- Record recipient, sender, industry, review type, workspace ID (if any), artifacts attached, NDA status, and links included.
- Keep a copy of the preview for reference.

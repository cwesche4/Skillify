# Security Pack Boundary: Product vs Automation vs Manual

Defines which parts of the Security Pack workflow belong in the product, remain external automation, or stay manual.

## Productized (in Skillify)

- Customer request UI (workspace admins/members submit; admins approve workspace exports).
- Status view (submitted/pending/approved/delivered) and delivery history metadata.
- Trust Center links surfaced in product.
- Preview of evidence package (template reference, attachments list, Trust links) before any send.

## External Automation

- Template selection, evidence bundle assembly, trust link resolution (per orchestration spec).
- Export generation (audit CSV/evidence bundle) triggered via automation with approval gates.
- CRM/workflow logging of delivery metadata.

## Manual Only (Never Automated)

- Legal approval for NDA-bound artifacts.
- Security/GRC approval for workspace exports and SOC-2 escalations.
- Emergency overrides during incidents.
- Any decision to share non-standard or customer-specific artifacts.

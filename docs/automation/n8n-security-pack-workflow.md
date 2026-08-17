# n8n Workflow Spec — Security Pack Orchestration

Deterministic workflow mirroring the Security Review Email Orchestration. No email sending; outputs a preview payload for manual approval.

## Trigger Inputs

- `industry` (fintech | healthcare | saas | enterprise | public-sector | bank/payments)
- `reviewType` (security-review | soc2-escalation | audit-request)
- `workspaceId` (optional, for workspace exports)
- `recipient` (email/contact reference)

## Nodes (Step-by-Step)

1. **Webhook/Manual Trigger**
   - Accepts input fields above.

2. **Industry Selector (Function)**
   - Logic: use provided `industry`; if missing/unknown → default `saas`.
   - Output: `industry`.
   - Example output: `{"industry": "fintech"}`

3. **Template Selector (Function)**
   - Map industry → template file path:
     - fintech → `docs/sales/security-review-email-fintech.md`
     - healthcare → `docs/sales/security-review-email-healthcare.md`
     - saas → `docs/sales/security-review-email-saas.md`
     - enterprise → `docs/sales/security-review-email-enterprise.md`
     - public-sector → `docs/sales/security-review-email-public-sector.md`
     - bank/payments → `docs/sales/security-review-email-bank-payments.md`
   - Output: `templateFile`.
   - Example: `{"templateFile": "docs/sales/security-review-email-fintech.md"}`

4. **Evidence Bundle Selector (Function)**
   - Based on `reviewType` (and `workspaceId`):
     - security-review/audit-request → AI Governance Evidence Bundle + Audit CSV (workspace-scoped if `workspaceId` provided)
     - soc2-escalation → SOC-2 AI Controls Bundle + AI Governance Evidence Bundle (+ Audit CSV if `workspaceId`)
   - Add flags: `ndaRequired`, `workspaceScoped`.
   - Output example:
     ```json
     {
       "bundles": [
         {"name": "SOC-2 AI Controls Bundle", "ndaRequired": true, "workspaceScoped": false},
         {"name": "AI Governance Evidence Bundle", "ndaRequired": true, "workspaceScoped": !!workspaceId},
         {"name": "Audit CSV Export", "ndaRequired": true, "workspaceScoped": !!workspaceId}
       ]
     }
     ```

5. **Trust Center Link Resolver (Function)**
   - Always include `/trust`.
   - If `reviewType` is soc2-escalation → add `/trust/compliance` and `/trust/audit-and-evidence`.
   - Otherwise add `/trust/ai-governance` and `/trust/audit-and-evidence`.
   - Output example:
     ```json
     {
       "links": [
         { "label": "Trust Center", "url": "/trust" },
         { "label": "Compliance", "url": "/trust/compliance" },
         { "label": "Audit & Evidence", "url": "/trust/audit-and-evidence" }
       ]
     }
     ```

6. **Assemble Preview (Function)**
   - Combine: `recipient`, `templateFile`, `bundles`, `links`, `workspaceId`, `reviewType`, `industry`.
   - Output example:
     ```json
     {
       "recipient": "security@example.com",
       "templateFile": "docs/sales/security-review-email-fintech.md",
       "bundles": [...],
       "links": [...],
       "workspaceId": "ws_123",
       "reviewType": "soc2-escalation",
       "industry": "fintech"
     }
     ```

7. **Manual Approval (Wait node)**
   - Human reviews preview payload; approves or rejects.

8. **Output (No Send)**
   - Emit approved payload for downstream handling (e.g., to a queue or CRM note). No email is sent within this workflow.

## Notes

- No new content generation; only selection and assembly.
- Workspace-scoped artifacts require `workspaceId`; if missing, omit and flag in preview.
- NDA-required items should be clearly marked in the preview for approver confirmation.

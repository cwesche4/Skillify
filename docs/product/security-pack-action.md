# Product Spec: Send Security Pack Action

Behavior-only specification for an enterprise “Send Security Pack” action. No sending logic or UI mockups included.

## Location

- Accessible from CRM deal view and customer profile pages; optional shortcut within workspace admin view when a workspaceId is available.

## Required Inputs

- Recipient (email or contact reference)
- Industry (fintech, healthcare, saas, enterprise, public sector, bank/payments)
- Review type (security review, SOC-2 escalation, audit request)
- Workspace ID (optional, required for workspace-scoped exports)

## Preview Requirements

- Assemble email body from selected industry template without modification.
- List attachments (evidence bundles, audit CSV if workspace provided, SOC-2 packet when applicable) with NDA/workspace flags.
- Include Trust Center links to be inserted.
- Present a human-reviewable summary before any send action.

## Approval Gating

- Require manual confirmation before send.
- If NDA artifacts are included, prompt to confirm NDA status and workspace scope.

## Audit Logging

- Log user initiating the action, timestamp, recipient, industry, review type, workspaceId (if used), selected template, and attachments/links.
- Store preview content for reference; do not store exported customer data.

## Errors & Fallbacks

- If industry is missing, default to B2B SaaS template and note fallback in preview.
- If workspaceId is missing for workspace-scoped exports, omit those exports and note in preview.
- If any required template or artifact is unavailable, block send and show error; allow retry after fixing inputs.

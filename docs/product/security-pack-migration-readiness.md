# Security Pack Migration Readiness Checklist

Objective criteria to decide if the Security Pack workflow can move from n8n to a native Skillify feature.

## Go/No-Go Checklist

- **Workflow stability:** n8n flow runs without errors across recent sends; edge cases (missing workspaceId, unknown industry) are handled with fallbacks.
- **Approval rules:** Security Pack Approval Policy is in place and followed; dual-approval paths tested for NDA/workspace exports.
- **Template freeze:** Email templates and evidence bundles are stable and approved (no pending content changes).
- **Audit expectations:** Delivery logging (who/what/when/NDA/workspace) is consistent; evidence retention/handling policy accepted by stakeholders.
- **UI requirements:** Input fields (industry, review type, workspaceId, recipient), preview, NDA flags, and approval prompts are defined; no unresolved UX gaps.
- **Customer-facing implications:** Trust Center links and evidence descriptions are current; public vs NDA distinctions are clear.

## Do Not Migrate Yet If…

- Templates or bundles are still changing frequently.
- Approval/sign-off process is unclear or not being followed.
- Logging or retention expectations are not defined or not met.
- UI requirements for preview/approval are unresolved.
- Evidence handling (NDA/workspace scope) is not consistently applied.

# Skillify Request Security Pack Page (Enterprise UX)

Neutral, enterprise-grade specification for the customer-facing request page. No marketing language or promises.

## Page Structure & Copy

### 1) Header

- Title: “Request Security Evidence”
- Description: “Request audit exports and supporting evidence for your workspace. Some items may require approval and NDA.”

### 2) Request Form

- Industry selector (dropdown): label “Industry” with options (fintech, healthcare, SaaS, enterprise, public sector, bank/payments).
- Evidence type selector (checkboxes or multi-select): “SOC-2 readiness packet”, “Audit CSV (workspace)”, “Evidence bundle (workspace)”.
- Workspace selector (shown when workspace-scoped evidence is chosen): label “Workspace”.
- NDA acknowledgement (checkbox): “Workspace-specific exports require an NDA and admin approval.”
- Submit button: “Submit request”.

Helper text: “Provide workspace and NDA confirmation for exports. Public Trust Center materials do not require NDA.”

### 3) Permission Handling

- If user is an admin: allow submission; note that approval may still be required for NDA items.
- If user is not an admin: allow submission but mark as needing admin approval for workspace exports; show helper: “Admins must approve workspace exports before delivery.”
- If user lacks workspace access: disable form with message: “You need workspace access to request exports.”

### 4) Status Panel

- Labels: Submitted, Under Review, Approved, Delivered, Declined.
- Copy examples:
  - Submitted: “Your request has been received.”
  - Under Review: “Your request is under review. NDA or approvals may be required.”
  - Approved: “Approved. Evidence will be prepared.”
  - Delivered: “Evidence is available to download.”
  - Declined: “Request declined. Contact support for details.”

### 5) What Customers See

- Request metadata: requested artifacts, workspace, submission date, status.
- Download links when approved/delivered (only for their workspace).
- No internal routing or approver details; statuses only.

### 6) What Customers Never See

- Email templates or internal message content.
- Approval routing or internal notes.
- Other workspaces or cross-tenant data.
- Internal process steps.

## Component Outline (No Code)

- Header block (title + description).
- Form block (industry selector, evidence selector, workspace input, NDA checkbox, submit).
- Permission notice banner (if non-admin or lacking access).
- Status block (current status, history, download links when allowed).
- Help/links block (Trust Center link).

## Status Lifecycle

- Submitted → Under Review → Approved → Delivered (or Declined).
- Workspace exports and NDA items require approval before moving to Delivered.
- If declined, show status with brief reason (non-sensitive).

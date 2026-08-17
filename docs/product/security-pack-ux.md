# Security Pack UX Contract

Defines the customer experience for requesting and receiving security packs. No UI mockups; behavior only.

## Entry Points

- Workspace settings (AI/Trust section) for admins to request evidence.
- Support/contact form for non-admin users to initiate a request.
- Optional link from Trust Center directing customers to request evidence.

## Permissions

- Workspace admins can request workspace-scoped exports and evidence bundles.
- Members can submit requests but require admin approval for workspace-scoped exports.
- Global operators handle SOC-2/GRC escalations and global disablement; not exposed to non-admin customers.

## Customer Visibility

- Customers see request forms, status (pending/approved/sent), and available downloads for their workspace.
- Customers do not see internal templates, approval routing, or other customers’ data.
- Workspace-scoped exports are only visible to authorized workspace admins.

## Status Tracking

- States: submitted → under review → approved → delivered.
- Customers can view current status and any required actions (e.g., confirm NDA).
- Delivery history shows what was delivered and when (metadata only, no other workspaces).

## Evidence Access Model

- Public artifacts: Trust Center links and summaries.
- Workspace artifacts: Audit CSV and evidence bundle available after approval; access gated to workspace admins.
- SOC-2 packet and mappings: Provided upon request and approval; marked as NDA where applicable.

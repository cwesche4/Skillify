# Customer-Initiated Security Pack Request Flow (Pre-Automation)

Defines the flow when a customer requests a Security Pack. No automation or sending logic is included.

## Required Inputs

- Requester identity (authenticated user)
- Workspace ID (if requesting workspace-specific exports)
- Desired artifacts (evidence bundle, audit CSV, SOC-2 packet)
- Industry/review context (optional)
- NDA confirmation (if applicable)

## Validation Rules

- Requester must belong to the workspace for workspace-scoped exports.
- Workspace admin required for audit CSV/evidence bundle downloads.
- If NDA is required and not in place, mark request as pending NDA.
- If inputs are incomplete (missing workspace ID for exports), request remains pending until provided.

## Approval Path

- Security/GRC approval required for NDA or workspace-scoped evidence.
- Legal approval required when NDA is absent or unclear.
- If request is public-only (Trust Center links), no approval needed.

## Customer vs Internal Views

- Customer sees: submission form, request status (submitted/pending NDA/under review/approved/delivered), and any actions needed (e.g., confirm NDA, provide workspace ID).
- Internal handling: template/evidence selection, trust link inclusion, approval routing, and final delivery. Customers do not see internal templates or routing.

## Failure / Pending States

- Missing NDA: status = pending NDA; no exports delivered until resolved.
- Not a workspace admin for exports: request escalated; admin approval required.
- Missing workspace ID: request pending additional info.
- If request is rejected: show status as declined with reason (non-sensitive).

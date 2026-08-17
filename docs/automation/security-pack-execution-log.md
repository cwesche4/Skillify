# Security Pack Execution Log Specification

Defines the expected log entries for Security Pack workflow runs. No implementation is included here.

## Log Fields

- `timestamp`: ISO string
- `actor`: user initiating the action
- `recipient`: intended recipient
- `industry`: resolved industry
- `reviewType`: security-review | soc2-escalation | audit-request | incident
- `workspaceId`: if provided (workspace-scoped exports)
- `templateFile`: selected email template reference
- `bundles`: list of bundle names with `ndaRequired` and `workspaceScoped` flags
- `trustLinks`: list of URLs included
- `status`: submitted | under-review | approved | delivered | declined
- `notes`: optional (e.g., fallback used, missing inputs)

## Approval Log Entries

- Record approver identity, timestamp, decision (approved/declined), and scope (which artifacts).
- Include reason if declined.

## NDA Confirmation Logging

- Record whether NDA is confirmed, pending, or missing.
- For workspace exports/bundles, log NDA status per request.

## Workspace Scoping Markers

- Explicit `workspaceId` field for any workspace-specific export.
- If multiple workspaces are involved (should not happen), log and block.

## Redaction Rules

- Do not log payload contents or customer data beyond identifiers above.
- Keep logs to metadata only (no audit CSV contents).

# Customer Request → Approval → Delivery Simulation

Scenario: Workspace admin (Fintech) requests SOC-2 evidence + audit CSV for a specific workspace (NDA required).

## Step-by-Step Trace

1. **Request submission:** Workspace admin submits request via product form with workspaceId provided, selecting SOC-2 evidence and audit CSV. NDA required flag set.
2. **Validation checks:** User belongs to the workspace; admin privileges confirmed. WorkspaceId present. NDA required → mark request as pending approval.
3. **Approval routing:** Security/GRC and Legal receive approval request (NDA + workspace export). No automation; awaiting explicit approval.
4. **Evidence selection:** Prepare SOC-2 AI Controls Bundle, AI Governance Evidence Bundle, and Audit CSV Export (workspace-scoped). Mark all as NDA and workspace-scoped where applicable.
5. **Delivery status update:** After approvals, status moves to approved → delivered once artifacts are made available. Metadata logged (who approved, when, artifacts).
6. **Customer-visible outcome:** Customer sees status change from submitted → under review → approved → delivered. Downloads available for audit CSV and evidence bundle; SOC-2 packet shared per approval. No other workspaces visible.

## Internal Handling Notes

- Do not send artifacts before approvals. If approval lags, keep in under-review and notify internally.
- If NDA is missing or unclear, hold and request confirmation from Legal.
- If workspaceId were invalid, skip exports and request correction before approval.

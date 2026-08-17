# Security Pack Auditor Pre-Flight Checklist

Use this checklist to confirm audit readiness before an external review.

- ☐ Approval logs exist for recent sends (initiator, approver, timestamp, artifacts, workspace scope, NDA status).
- ☐ NDA enforcement applied to workspace-specific exports and evidence bundles; no NDA → no delivery.
- ☐ Evidence scope correct: workspace exports tied to the right workspace ID; no cross-workspace data.
- ☐ Customer visibility boundaries respected: customers see only their requests and artifacts; internal templates/routing are hidden.
- ☐ Failure handling documented: invalid workspace, missing NDA, approver non-response, evidence generation failure, unsupported requests (see failure handling doc).

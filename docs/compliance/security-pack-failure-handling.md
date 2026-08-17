# Security Pack Failure & Escalation Handling

Defines expected handling for common failure cases. No runtime logic is implemented here.

## Invalid Workspace ID

- Behavior: Do not generate workspace-scoped exports; flag the request as needing correction.
- Escalation: Notify requester to provide a valid workspace ID; no evidence sent until resolved.

## Missing NDA

- Behavior: Hold workspace-scoped exports and bundles; provide only public Trust Center links if needed.
- Escalation: Request NDA confirmation; involve Legal/Security per approval policy.

## Approver Non-Response

- Behavior: Keep request in pending; do not send evidence.
- Escalation: Follow approval policy—escalate to Security/GRC lead after defined reminder; no auto-approval.

## Evidence Generation Failure

- Behavior: Stop the workflow; do not send partial exports.
- Escalation: Notify internal owner; retry after issue resolved; communicate delay to requester without exposing internals.

## Unsupported Artifact Request

- Behavior: Decline the request for that artifact; offer supported evidence (Trust Center, audit export, evidence bundle, SOC-2 packet where applicable).
- Escalation: If unclear, route to Security/GRC for guidance.

# Evidence Retention & Handling Policy (AI Governance)

Purpose: Describe handling of AI governance evidence artifacts and delivery metadata. No guarantees or SLAs are made.

## Artifacts

- **Audit CSVs:** Generated for specific workspaces on request. Intended for short-term use during reviews; not retained beyond the review window unless otherwise required by the requester. Workspace-specific; NDA-bound.
- **Evidence Bundles:** ZIPs combining audit exports and control references. Same handling as Audit CSVs; short-term retention for the active review only.
- **Delivery Logs:** Metadata of who initiated/sent, recipient, timestamp, artifacts included, NDA/workspace flags. Retained to support auditability of evidence distribution; duration aligned with internal audit needs. Does not include customer payloads.

## Handling Notes

- Workspace-scoped artifacts are produced per request and should be purged after the review window unless the requester asks for longer retention.
- NDA applies to workspace-specific exports and bundles.
- Delivery logs are for accountability and review; no payload content is stored.

# Security Pack Audit Timeline UI Mapping

Customer-facing timeline for `SecurityPackAuditEvent`. No payloads or internal routing exposed.

## Event Mapping

| Event Type         | Label (customer)  | Indicator | Description                                                        | Visibility |
| ------------------ | ----------------- | --------- | ------------------------------------------------------------------ | ---------- |
| REQUEST_SUBMITTED  | Request submitted | Neutral   | “Your evidence request has been received.”                         | Customer   |
| VALIDATION_FAILED  | Validation issue  | Warning   | “Additional information is required to process this request.”      | Customer   |
| APPROVAL_REQUESTED | Under review      | Neutral   | “Your request is under review. Approvals may be required.”         | Customer   |
| APPROVED           | Approved          | Success   | “Your request has been approved.”                                  | Customer   |
| REJECTED           | Declined          | Error     | “Your request was declined. Contact support for details.”          | Customer   |
| DELIVERY_MARKED    | Delivered         | Success   | “Evidence is available to download.”                               | Customer   |
| DELIVERY_FAILED    | Delivery issue    | Warning   | “There was an issue preparing the evidence. We are investigating.” | Customer   |

## Timeline Rules

- Order events by `createdAt` ascending.
- Show event label, timestamp, and high-level artifact scope (e.g., “Requested: SOC-2 packet, audit CSV”).
- No internal roles, approvers, or routing are shown.
- No payload contents; metadata only.
- History is read-only; no editing or removal.

## Metadata Shown

- Event timestamp (ISO formatted for display).
- Artifact types requested (from requestedArtifacts or bundles names).
- NDA status only as text (“NDA confirmed”/“NDA pending”) if present in decision notes; no other notes.

## Never Shown

- Internal approver names/roles.
- Decision notes beyond high-level NDA status.
- Automation system names, correlation IDs.
- Any payload or customer data beyond requested artifact labels.

## Example Timeline (Rendered)

1. **Request submitted** — 2025-02-10T12:00Z — Requested: SOC-2 packet, audit CSV
2. **Under review** — 2025-02-10T12:05Z — NDA pending
3. **Approved** — 2025-02-10T12:30Z — NDA confirmed
4. **Delivered** — 2025-02-10T13:00Z — Evidence available to download

_Footnote: Events are generated automatically and may be delayed during approval or delivery._

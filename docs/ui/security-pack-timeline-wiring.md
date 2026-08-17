# Security Pack Timeline UI Wiring

Read-only wiring to the timeline API. The API is the source of truth; no optimistic states or inferred statuses.

## Data Flow

- Fetch `GET /api/security-pack/request/:id`.
- Handle loading, 403 (forbidden), 404 (not found), and generic error states.
- Render response fields directly; do not transform ordering.
- Timeline items use API order; no client sorting.

## Component Structure (no styling)

- `SecurityPackRequestHeader`
  - Inputs: `request` (id, workspaceId, industry, reviewType, requestedArtifacts, createdAt)
  - Renders metadata only; no internal IDs beyond request/workspace.
- `SecurityPackTimeline`
  - Inputs: `timeline` array from API (eventType, createdAt, label, optional note).
  - Maps to `SecurityPackTimelineItem`.
- `SecurityPackTimelineItem`
  - Inputs: `label`, `createdAt`, `note?`.
  - Renders timestamp and note (e.g., NDA pending/confirmed) if present.
- `SecurityPackDownloadAction`
  - Inputs: `downloadAvailable`, `downloadUrl?` (from API, if present).
  - Renders CTA only when `downloadAvailable === true`; otherwise hidden.
- `SecurityPackFootnote`
  - Inputs: `footnote` (from API).

## States

- Loading: show spinner/skeleton while fetching.
- Empty timeline: show “No audit events yet.”
- 403: “You do not have access to this request.”
- 404: “Request not found.”

## API → UI Mapping

| API field                    | UI component           | Notes                                                                     |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `request` object             | RequestHeader          | Show id, workspaceId, industry, reviewType, requestedArtifacts, createdAt |
| `timeline[].label`           | TimelineItem.label     | Use as-is; no client relabeling                                           |
| `timeline[].createdAt`       | TimelineItem timestamp | Render as provided                                                        |
| `timeline[].note`            | TimelineItem.note      | Only NDA-related if present                                               |
| `download.downloadAvailable` | DownloadAction         | CTA shown only if true                                                    |
| `download.downloadUrl`       | DownloadAction         | Use if provided; otherwise CTA hidden                                     |
| `footnote`                   | Footnote component     | Render verbatim                                                           |

## Visibility Rules

- Do not display internal roles, approvers, automation systems, correlation IDs, or decision notes beyond NDA note provided by API.
- Timeline order must match API (no resorting).
- No inferred statuses; rely solely on API events and labels.

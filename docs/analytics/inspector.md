# Inspector Telemetry — Analytics Schema (Design Only)

**Purpose:** Provide a stable, analytics-friendly contract for Inspector telemetry without changing production behavior or event semantics.

## Event Categories (canonical)

- **lifecycle**
  - `inspector_opened`
  - `inspector_closed`
  - Payload keys: `workspaceId`, `automationId`, `dockSide`, `widthPreset`, `pinned`, `timestamp`

- **navigation**
  - `inspector_tab_changed`
  - `inspector_tab_viewed`
  - Payload keys: `workspaceId`, `automationId`, `nodeType`, `tab`, `previousTab`, `timestamp`

- **ai**
  - `inspector_ai_score_computed`
  - `inspector_ai_suggestion_shown`
  - `inspector_ai_suggestion_viewed`
  - `inspector_ai_suggestion_dismissed`
  - `inspector_ai_action_applied`
  - `inspector_ai_action_failed`
  - `inspector_ai_autofix_applied`
  - `inspector_ai_autofix_failed`
  - Payload keys: `workspaceId`, `automationId`, `nodeType`, `tab`, `dockSide`, `widthPreset`, `timestamp`

- **validation**
  - `inspector_validation_failed`
  - `inspector_validation_cleared`
  - Payload keys: `workspaceId`, `automationId`, `nodeType`, `timestamp`

- **presets**
  - `inspector_preset_saved`
  - `inspector_preset_applied`
  - `inspector_preset_deleted`
  - Payload keys: `workspaceId`, `automationId`, `nodeType`, `presetName`, `timestamp`

- **other**
  - `inspector_replay_deeplink_clicked`
  - `inspector_work_mode_changed`
  - Payload keys: `workspaceId`, `automationId`, `nodeType`, `mode`, `timestamp`

> **Non-goals:** Do not add/rename events. This document only describes existing events for analytics readiness.

## Aggregation Keys (safe)

- `workspaceId`, `automationId`, `nodeType`, `tab`
- Timestamp buckets (e.g., hour/day/week)
- `dockSide`, `widthPreset`, `mode`, `pinned`

## Derived Metrics (examples)

- **Inspector open duration**: `inspector_opened` → `inspector_closed` per session to compute duration.
- **Tab engagement**: Count `inspector_tab_viewed` per `nodeType` + `tab`.
- **AI suggestion acceptance rate**: `inspector_ai_suggestion_shown` vs `inspector_ai_autofix_applied` (or `inspector_ai_action_applied` where applicable).
- **Validation failure frequency**: Ratio of `inspector_validation_failed` to `inspector_validation_cleared` per `nodeType`.
- **Preset usage frequency**: Count of `inspector_preset_*` events per `nodeType` and workspace.

## Data Never Collected

- No PII (user names/emails).
- No raw node configuration, prompts, URLs, or payload bodies.
- No request/response logs.

## Analytics Use Cases (future)

- **Heatmaps:** Use tab/field-level interaction counts (from existing events) to highlight high-usage areas without storing raw data.
- **Funnels:** Open → tab viewed → validation failed → suggestion shown → autofix applied (all from existing events).
- **AI coaching insights:** Aggregate AI events by node type to see where AI is most/least accepted, without collecting content.

## Separation of Concerns

- **Event logging:** Continues to use existing telemetry pipeline (no changes required).
- **Analytics interpretation:** Should consume these canonical events and payload shapes, applying the above aggregation rules. No additional data collection is permitted without privacy review.

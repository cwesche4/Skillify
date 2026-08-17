# AI Safety Overview

Plain-language statements you can reuse in settings, sales decks, or security questionnaires. These reflect existing controls only.

- **Controlled AI actions**: AI actions are gated by a workspace kill switch and can be globally disabled by operators. If disabled, AI endpoints return explicit errors and take no action.
- **Auditable by design**: Every AI action is recorded server-side with before/after snapshots, denial reasons, and integrity hashes to prove records have not been tampered with. Exports are immutable CSV snapshots with metadata (generated time, workspace, exporter).
- **Instant disablement**: Operators can halt all AI actions platform-wide via environment configuration, and workspace admins can toggle AI actions per workspace.
- **Abuse detection signals**: The platform emits metrics and alerts for denials, rate limits, and undo conflicts to detect misuse or anomalies without inspecting payload contents.
- **No client trust**: Controls are enforced on the server; UI toggles reflect server truth and cannot bypass kill switches or rate limits.

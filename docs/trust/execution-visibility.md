# Execution Visibility — Trust & Safety (Public)

What we show

- Node-level outcomes (success / failed / skipped) from timeline events.
- Live execution highlights (active / completed / explicitly skipped).
- Failure messages exactly as emitted in events, no stack traces or payloads.
- Timeline→canvas jumps for precise correlation.

What we never infer

- No predictions, confidence scores, or estimated progress.
- No dimming or “skipped” without an explicit skip event.
- No aggregation across runs; one run drives the canvas at a time.
- No retries, pauses, or controls from the UI.

Why this is trustworthy

- Timeline is the single authority; visuals are read-only and event-sourced.
- No execution control or mutation is exposed in the builder UI.
- Visual state is transient—refresh clears highlights; nothing is persisted.
- Absence of an event means we show nothing; there is no “best guess.”

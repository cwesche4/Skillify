Execution-aware UI shows what happened during an automation run directly on the canvas. It highlights which nodes ran, which failed, which were skipped, and the last recorded outcomes, so you can understand execution without leaving the builder.

It does not control, retry, pause, or mutate any run. The UI is strictly read-only with respect to execution.

Every visual element is sourced from immutable timeline events. If there is no event, nothing is shown. No aggregation across runs and no hidden state are introduced.

No inference or prediction is used. There are no confidence scores, estimated progress bars, or “likely” statuses.

There are no raw payloads, stack traces, or cost/token data displayed. Failure messages come verbatim from the relevant event.

Clicking timeline entries or badges only centers the view; it never re-executes or sends requests. Visual highlights clear on refresh or Escape and are not persisted.

This boundary exists to keep execution trustworthy and auditable: what you see is exactly what was recorded, and nothing in the UI can change a run’s outcome.

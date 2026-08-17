# Execution Visibility — Sales Engineering Training (Internal)

Allowed language (use verbatim)

- “This view reflects timeline events only; the UI is read-only with respect to execution.”
- “No inference or prediction is shown—if an event is missing, we show nothing.”
- “One run at a time drives the canvas; switching runs is explicit.”
- “Clicking timeline entries or badges only centers the view; nothing re-runs.”

Disallowed claims (do not say)

- “We can probably tell you if it ran / is pending.”
- “The UI can retry, pause, or fix a run.”
- “It shows confidence or estimates progress.”
- “This is a debugging tool / log viewer / tracing console.”

How to position it

- Execution visuals are event-sourced and read-only; they do not control or mutate runs.
- No logs, payloads, or stack traces are shown—only event facts.
- No aggregation across runs; no persistence of highlights.

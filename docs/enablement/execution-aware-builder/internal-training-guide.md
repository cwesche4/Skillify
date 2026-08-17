Execution-Aware Builder — Internal Training Guide

Mental Model (what it is / isn’t, and why it matters)
What it shows: Exact execution facts from timeline events: which nodes ran, which failed, which were skipped, last outcomes, and live/last-run highlights.
What it never shows: Predictions, confidence scores, inferred states, raw payloads, cost/tokens, or anything not backed by an event.
Why this matters: Trust comes from surfacing only immutable, event-sourced facts; the builder is read-only with respect to execution.
Allowed vs Disallowed Language
Use:
“This view reflects timeline events only.”
“Highlights and badges are read-only and do not affect execution.”
“Clicking timeline events jumps to the corresponding node; nothing re-runs.”
“If there is no event, we show nothing.”
Avoid:
“It probably ran / might be pending.”
“The UI will retry/pause for you.”
“We predict the outcome / estimate progress.”
“This is a debugging tool” or “this is observability/tracing.”
Any mention of logs, payloads, confidence, or cost.
FAQ
What if an event is missing?
We do not infer. The UI stays silent until an authoritative event arrives.
Can users control execution from the builder?
No. The builder is read-only with respect to execution; no retries, pauses, or edits are triggered.
Is this replaying or re-running?
Replay is visual only. It does not re-execute or send any calls; it steps through recorded events.
One-Sentence Rule (memorize)
“Everything you see here is a read-only reflection of timeline events—no inference, no control.”

# Execution Visibility FAQ (Audit-Safe)

Q: What is the authority for execution visuals?  
A: The timeline. All highlights, badges, and statuses are sourced directly from timeline events.

Q: Can the builder UI control, retry, or pause execution?  
A: No. The UI is read-only with respect to execution; no controls are exposed.

Q: Do visuals ever infer state (e.g., “probably ran”)?  
A: No. If an explicit event is absent, nothing is shown. No predictions, confidence scores, or estimates are displayed.

Q: Are multiple runs blended or aggregated?  
A: No. Exactly one run drives the canvas at a time; switching runs is explicit and clears transient visuals.

Q: What data is intentionally excluded?  
A: Raw payloads, stack traces, cost/token data, and any inferred or aggregated metrics.

Q: Does any of this persist?  
A: No. Visual state (highlights, live glow) is transient; refresh clears it. No persisted fields are added.

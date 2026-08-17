Execution-Aware Builder — Public Demo Script (5–6 min, trust-first)

0:00–0:45 — Build (edge-first, inline)

Action: Drag from a node output; QuickAdd appears at cursor with compatible choices. Select a node; it’s placed and connected. Inline config auto-expands; edit a field inline.
Callout (not happening): No inspector, no other tabs, no auto-magic.
Viewers notice: Immediate placement, no side panels, faster than whiteboarding.
0:45–1:15 — Run (canvas stays visible)

Action: Start the run; keep the canvas in view.
Callout (not happening): No tab switch, no logs, no tracing UI.
Viewers notice: Context doesn’t change when execution starts.
1:15–2:15 — Observe live execution

Action: As events arrive, point to the active glow on the running node; completed nodes stay lightly highlighted; if a node fails, its badge shows “Failed” + timestamp, hover reveals the event message. Skipped branches stay dim.
Callout (not happening): No inference, no confidence scores, no retries or control from UI. Only event-sourced facts appear.
Viewers notice: Facts appear where they happen; nothing is guessed.
2:15–3:00 — Correlate via timeline → canvas

Action: Open the timeline; click a node-linked event to jump/center on it. Shift+click another event to highlight multiple paths. Press Escape to clear.
Callout (not happening): Clicks do not re-run or mutate execution; highlight is visual-only.
Viewers notice: Instant spatial correlation; no lag, no state changes.
3:00–3:45 — Replay (visual only)

Action: Start replay controls (play/pause/step). Nodes highlight in recorded order; no calls sent.
Callout (not happening): No re-execution, no network calls, no data mutation. Purely visual.
Viewers notice: Deterministic playback of the same path they just saw live.
3:45–4:30 — Show failure surfaced on-node

Action: Navigate to a failed node; hover its badge for the exact event message.
Callout (not happening): No stack traces, no payloads, no inspector.
Viewers notice: The “why” is present, concise, and event-sourced.
4:30–5:30 — Recap clarity and constraints

Summarize: “Everything you saw is a read-only reflection of timeline events—no inference, no control, no persistence of highlights. Timeline is the authority.”
Reinforce: Visual state clears on refresh/Escape; execution engine was never touched.
What viewers notice (subtly)

Speed: Build→Run→See→Replay all on one surface.
Trust: Only facts from events; no optimistic hints.
Safety: No controls to retry/pause; no logs or payloads shown.
Clarity: Jumps and highlights are instant; failures are visible in place.

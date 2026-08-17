Setup and framing (10–15 seconds)
“This is a read-only demo flow. Nothing here mutates production. If we want to change it, we duplicate it first.”
“Everything you see is event-sourced; nothing is inferred.”
Walk the flow structure (30–45 seconds)
Point: Lead submission trigger → data normalization → AI classification (explicit outputs) → decision routing → approval pause → CRM action → simulated failure path.
Call out: “AI node outputs are explicitly named and connectable; there is no ‘AI decides’ behavior.”
Build ergonomics (edge-first + keyboard) (30 seconds)
“We add nodes by dragging from an edge; only compatible options appear. Typing filters them; Enter selects. Escape cancels cleanly.”
“Cmd/Ctrl+D duplicates selection with a predictable offset; Cmd/Ctrl+. zooms to selection.”
Run and observe execution (45–60 seconds)
Start a run; keep canvas visible.
“Active node glows; completed nodes stay highlighted; skipped only shows when an explicit skip event exists.”
“Failure badges show the exact event message underneath—no logs or payloads here.”
“Run status and run selector at the top: one run at a time, explicitly labeled.”
Approval wait and failure path (30 seconds)
Point to approval node: “This waits for approval (event-backed). No timers or guessing.”
Simulated failure path: “This failure is simulated and labeled; no real data, no hidden steps.”
Timeline ↔ canvas correlation (30 seconds)
Click a timeline event: “Jump centers on that node; Shift-click highlights multiple paths; Escape clears. Nothing re-runs—these are read-only visuals from events.”
AI node clarity (20–30 seconds)
“Prompt is inline and sent exactly as written. Inputs are explicit; outputs are named ports. No confidence scores, no implicit outputs.”
Close with trust boundaries (10–15 seconds)
“No inference, no prediction, no execution control from the canvas. Visual state clears on refresh; it’s transient by design.”
“To edit, we duplicate the demo; production flows are separate.”
What is real vs simulated

Real: Structure, compatibility, event-sourced execution visuals, AI node IO naming.
Simulated: Failure path (clearly labeled), demo data (not real PII), read-only mode.
What is not inferred

Skips only with skip events; no implied progress or confidence.
No auto-wiring, no auto-retries, no hidden defaults applied retroactively.
Execution visuals, plain language

“Glow = currently running; green = completed; dimmed only when a skip event exists; red badge + one-line message = failure.”
“Run selector scopes visuals to the chosen run; nothing blends across runs.”
Tone guide

Stick to facts, avoid hype words, and repeat: “event-sourced,” “read-only,” “explicit,” “no inference.”

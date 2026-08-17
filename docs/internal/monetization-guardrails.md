# Monetization Guardrails (Engineering)

Purpose: Prevent monetization changes from undermining reliability, auditability, or trust. Internal-only.

## Core Guardrails

- No retroactive enforcement: new gating must not break existing automations or runs.
- No breaking changes to historical data or timelines.
- No UI-only gating: all enforcement must be server-side and entitlement-based.
- Event-based only: gating and usage must rely on auditable events, not hidden state.
- Concealment: sensitive routes must return 404 when unauthorized to avoid existence leakage.

## PR Checklist

- [ ] Does the change introduce or modify entitlements? Ensure server-side checks only; no plan-name logic.
- [ ] Are existing runs and timelines unaffected? No mutation of historical records.
- [ ] Are new limits soft and informational unless explicitly approved? No silent blocking.
- [ ] Are audit events append-only with no status fields mutated?
- [ ] Are client/UI hints purely reflective of server truth?
- [ ] Are concealment rules preserved (404 for unauthorized sensitive accesses)?
- [ ] Does documentation avoid pricing/SLA language and align with Trust Center phrasing?

## Red-Line Violations (Do Not Merge)

- Adding hard-blocking monetization without contract-driven entitlements.
- Mutating historical audit/timeline data to align with pricing.
- UI-only enforcement or plan-name branching without server validation.
- Retroactive downgrades that break existing executions or deliveries.
- Exposure of pricing, SLA, or roadmap claims in product or docs.

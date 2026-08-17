# Automation Builder UX Hardening Guardrails

Prevent regressions that undermine reliability and trust. Builder state must reflect runtime reality.

## UX Invariants (Must Always Hold)

- No hidden execution behavior: what you see in the builder is what runs; grouping is visual-only.
- No UX-only enforcement: all gating (entitlements, approvals, downloads) is server-enforced; UI cannot bypass.
- Pre-execution validation surfaces actionable errors/warnings; blocking errors prevent execution.
- Disabled nodes and deprecated nodes are clearly indicated and skipped in previews.
- Version history is immutable and read-only; restores create new versions.

## Forbidden UX Patterns

- UI toggles that imply access/entitlements/approvals without server enforcement.
- Silent failures or hidden errors; no blocking saves without explanation.
- Auto-approvals or implicit status changes without append-only events.
- Persisting payloads/URLs in UI state that suggests storage.
- Plan/SKU-based gating in UI that is not enforced server-side.

## Required Pre-Execution Checks

- Flow validation runs before execution; blocking errors (missing config, invalid connections, cycles) must be resolved.
- Run preview available and labeled “simulation only”; no side effects.
- Ensure disabled nodes are skipped; collapsed groups do not alter execution path.

## PR Checklist (Builder UX Changes)

- [ ] No UI-only enforcement; server checks remain source of truth.
- [ ] Validation still surfaces blocking errors; no silent failures added.
- [ ] Grouping remains visual-only; no execution/path changes.
- [ ] Run preview remains read-only; no side effects.
- [ ] No plan/SKU logic introduced.
- [ ] No storage or exposure of payloads/URLs in UI artifacts.
- [ ] Version history remains immutable; restores create new versions.

## Anti-Patterns

- Adding “enable” switches that do not map to entitlements or server validation.
- Hiding errors to allow execution/saves.
- Mutating historical versions instead of creating new ones.
- Changing execution paths based on visual state (collapse/expand) or grouping.

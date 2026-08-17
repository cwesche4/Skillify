# AI Flow Primitive Guardrails (Builder + Runtime)

Prevent AI features from drifting into unsafe, opaque, or sales-driven behavior.

## Forbidden Patterns

- Hidden prompts or dynamic prompt injection without UI visibility.
- Silent retries or hidden fallbacks.
- Dynamic category/branch creation at runtime.
- Free-form outputs where schema/branches are required.
- “Smart defaults” that change execution without being shown in preview.
- Plan/SKU gating that is not server-enforced.

## Required Preview Coverage

- Preview must show branches/categories, thresholds, and fallbacks (AI Decision/Classifier).
- Preview must show expected schema/fields (AI Transform/Splitter).
- Run preview must match runtime path (no hidden adjustments).
- Cost/token estimates (if shown) labeled as “estimate” and non-binding.

## Execution Logging Requirements

- Logs must be human-readable: include input summary (no payloads), decision/category chosen, confidence, explanation, fallback usage.
- No storage of full prompts/outputs; metadata only where required.
- Errors must be explicit (schema mismatches, missing config); no silent failures.

## PR Checklist (AI Nodes)

- [ ] No hidden prompts; configuration visible in UI and preview.
- [ ] Branches/categories are predefined; no dynamic creation.
- [ ] Outputs are schema-bound where required; validation fails fast.
- [ ] Preview matches runtime behavior; no hidden fallbacks.
- [ ] Logging captures decision/category, confidence, explanation, fallback flag; human-readable.
- [ ] No silent retries; errors surface clearly.
- [ ] No plan/SKU gating introduced without server enforcement.
- [ ] Guardrails: no storage of payloads/URLs in audit/logs.

## Anti-Patterns

- Auto-generating branches/categories at runtime.
- Allowing free-form outputs when structured output is required.
- Implicit retries or hidden backoff logic without surfacing to users.
- Changing behavior based on UI-only state (collapse, grouping) or “smart” toggles not reflected in preview/logs.

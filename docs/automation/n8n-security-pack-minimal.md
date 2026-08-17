# Minimal n8n Security Pack Workflow

Goal: Fewer nodes while keeping deterministic behavior and approval gates intact.

## Before (Expanded)

1. Trigger
2. Industry Selector
3. Template Selector
4. Evidence Bundle Selector
5. Trust Link Resolver
6. Assemble Preview
7. Manual Approval
8. Output (no send)

## After (Minimal)

1. Trigger (collect inputs)
2. Selector Function (industry + template + bundles + links in one deterministic function)
3. Assemble Preview (may be merged with selector output if clear)
4. Manual Approval (must stay separate)
5. Output (no send)

## Notes

- Industry, template, bundle, and link selection can be combined into a single function node with clear mapping logic.
- Manual approval must remain its own node to enforce human review.
- Export generation (if later added) should remain separate from approval.
- No behavior changes: same attachments/links, same approval requirement, same outputs.

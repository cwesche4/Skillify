# Template Safety & Compliance Guardrails

Templates must not undermine trust or runtime guarantees.

## Prohibited Content

- No credentials, secrets, or tokens embedded.
- No auto-enabled webhooks or external calls.
- No skipped approvals or bypass of entitlements.
- No hidden prompts or dynamic branching beyond defined schema.

## Enforcement

- Templates are read-only until cloned; no execution until saved.
- Server-side entitlements/approvals still apply; templates cannot bypass.
- Validation must fail templates with prohibited content.

## Review/Approval

- Compliance review required for published templates.
- Immutable versions once published; new versions require re-validation.

## Validation Hooks

- Validate absence of credential-like fields.
- Validate webhooks are not auto-triggered.
- Ensure approvals/entitlements are not bypassed in flow definition (structural checks).

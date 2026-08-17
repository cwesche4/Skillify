# Security Pack Upgrade Messaging (Enterprise UX)

Neutral copy for gated Security Pack features. No sales or urgency language.

## Copy Blocks

1. **Feature Gated (Non-Enterprise Plan)**

- Message: “This action is available on the Enterprise plan.”
- Usage: Inline or tooltip when a restricted control is disabled.

2. **Read-Only Access**

- Message: “You can view this request, but submitting or exporting requires Enterprise access.”
- Usage: Banner on read-only views.

3. **Approval Required**

- Message: “This request requires approval by an authorized reviewer.”
- Usage: Inline notice after submission; do not imply self-approval.

4. **Download Restricted**

- Message: “Downloads are not available for this request.”
- Usage: Inline near the download section when CTA is hidden/disabled.

## Usage Guidance

- Tooltips for single controls; banners for page-level notices.
- Keep messages short and factual; reference “Enterprise” once if needed.
- Do not include pricing, timelines, or calls to action.

## Accessibility Notes

- Ensure messages are readable by screen readers (use `aria-label` or `aria-describedby` on disabled controls).
- High contrast text for banners/tooltips; avoid color-only cues.

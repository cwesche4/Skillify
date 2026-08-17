# Regulated Industry Language Guidelines (Fintech/Banking/Payments)

Use conservative, risk-committee-appropriate phrasing for security communications. This guides wording only; do not change control meanings.

## Substitution Rules

- “can” → “is designed to” / “allows”
- “will” → “is expected to”
- “guarantees” → avoid; use “enforced by” or describe the control factually
- “always” → “in normal operation” / “by design”
- “prevent” → “reduce the risk of” / “limit”
- “ensure” → “provide controls to”

## Phrases to Avoid

- Guarantees, warranties, or SLA-like language
- Future/roadmap statements (“will add”, “planned”, “soon”)
- Marketing claims (“best-in-class”, “state-of-the-art”)
- Absolute terms without qualification (“never”, “always”)
- Compliance certifications unless already obtained

## Preferred Verbs/Structures

- “is enforced on the server”
- “is controlled by”
- “returns explicit errors”
- “records [data] with integrity hashes”
- “is designed to limit”
- “is available upon request”
- “can be disabled by admins” → tighten to “admins can disable via [control]”

## Examples (Before → After)

- “We can disable AI instantly.” → “AI is designed to be disabled immediately via global or workspace controls.”
- “All AI changes are always logged.” → “AI changes are logged with integrity hashes in normal operation.”
- “We prevent abuse with rate limits.” → “Rate limits are designed to limit abusive use; exceeding limits returns explicit errors.”

## Applicability

- Security review emails
- Trust Center summaries
- Evidence delivery notes

## Notes

- Keep statements factual and present-tense about implemented controls.
- Avoid implying certification or guarantees; reference existing evidence instead.

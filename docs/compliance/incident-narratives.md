# Incident Narrative Playbooks — Security Pack (No SLA)

Controlled, factual language for incidents. No timelines, blame, or admissions.

## Narratives

### Unauthorized Access Attempt

- Narrative: “An access attempt was blocked by entitlement and approval controls. Unauthorized or undelivered requests return ‘not found/forbidden’ and do not expose data. Audit records remain intact and append-only.”
- Usage: Sales/Compliance can share this to describe protection posture without committing timelines or outcomes.

### Delivery Delay

- Narrative: “Delivery requires recorded approvals and entitlements. If delivery is delayed, exports are not generated until those conditions are met. Audit timelines reflect events as they occur; no SLA or timing guarantee is implied.”
- Usage: Explain delays without promising remediation times or outcomes.

### Automation Failure

- Narrative: “Automation uses scoped tokens and idempotent callbacks. If a callback fails, no data is exposed and no duplicate events are created. Delivery is contingent on successful, authorized callbacks; timing is not guaranteed.”
- Usage: Describe automation posture without admitting fault or promising timelines.

## Sales + Compliance Usage Guide

- Use narratives verbatim; do not add timelines, guarantees, or admissions.
- If pressed for remediation details, escalate to Compliance; do not improvise.
- Reinforce non-guarantees and controls: entitlement gating, append-only audits, no stored URLs, no self-service.

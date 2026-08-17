# Trust Operations Control Plane — Security Pack

Versioned, reviewable, auditable process for Trust Center, compliance artifacts, and sales usage. No new security claims.

## Workflow (Lifecycle & Flow)

```
Draft → Reviewed → Approved → Published → Deprecated
   ^                                  |
   |                                  v
   +----------- Change / Rollback <---+
```

- Draft: Authoring by Compliance/Sales Enablement.
- Reviewed: Legal + Compliance review for language and alignment.
- Approved: Compliance Owner sign-off; Legal sign-off if contract touchpoints.
- Published: Live in Trust Center / sales workspace.
- Deprecated: Superseded content retained for audit history.

## RACI (Key Roles)

| Artifact Type                  | Compliance Owner | Legal Reviewer | Sales Enablement | Engineering (optional) |
| ------------------------------ | ---------------- | -------------- | ---------------- | ---------------------- |
| Trust Center copy              | A/R              | C/A            | C                | I                      |
| FAQs                           | A/R              | C              | C/A              | I                      |
| Procurement questionnaire      | A/R              | C/A            | C                | I                      |
| Objection handling/battlecards | C                | C              | A/R              | I                      |
| RFP tests/readiness scorecard  | A/R              | C              | C                | I                      |
| SOC-2 interview scripts        | A/R              | C              | C                | I                      |

A = Accountable, R = Responsible, C = Consulted, I = Informed.

## Change Triggers (Require Re-Approval)

- Security control change impacting access, approvals, audit, automation, data handling.
- Contract change affecting entitlements or non-guarantees.
- Audit feedback requiring clarifications.
- Customer objection patterns indicating unclear or insufficient language.
- Regulatory or certification posture updates.

## Changes That Do NOT Require Re-Approval

- Typos, formatting, and non-substantive language tightening that do not alter meaning or guarantees (still versioned).
- Link updates that do not change referenced content meaning.

## Change Control Rules

- Every change moves through Draft → Reviewed → Approved → Published with recorded approvers.
- Legal review mandatory when contract terms, entitlements, or non-guarantees are touched.
- Sales Enablement review mandatory when sales-facing guidance or objection handling changes.
- No founder-only steps; approvals must follow roles above.

## Rollback Policy

- If published content is found inaccurate or risky, revert to last Approved version and mark current as Deprecated.
- Emergency rollback can be initiated by Compliance Owner or Legal; post-mortem required.
- All rollbacks logged with reason and approver.

## Versioning Policy

- Each artifact maintains version, date, and approvers.
- Published versions must reference the source repo location; no ad-hoc copies.
- Quarterly review to confirm Trust Center, questionnaire, and sales materials remain aligned with controls and audits.

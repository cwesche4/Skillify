# Trust Center Governance & Change Control — Security Pack

Objective: prevent unauthorized edits, claims drift, or accidental over-promising. SOC-2 compatible; all changes reviewable and attributable.

## Roles & Responsibilities

| Role                 | Responsibilities                                                       | Edit Rights                                            |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Compliance Owner     | Accountable for content accuracy, approves changes, manages change log | Approve/Publish                                        |
| Legal Reviewer       | Reviews contract alignment, non-guarantees, and risk language          | Review/Approve (when contract/non-guarantees affected) |
| Sales Enablement     | Suggests updates for clarity; cannot approve/publish                   | Draft/Suggest only                                     |
| Engineering/Security | Advises on control descriptions; cannot publish                        | Draft/Suggest only                                     |
| Sales                | No edit rights; read-only                                              | None                                                   |

## Approval Workflow (Trust Center Edits)

1. Draft created (Compliance or delegated author).
2. Reviewed by Compliance; Legal review required if contract terms/non-guarantees touched.
3. Approved by Compliance Owner (and Legal if applicable).
4. Published to Trust Center with version/date.
5. Deprecated if superseded; prior versions retained for audit history.

## Change Log Requirements

- Record: what changed, why, who approved, date/version.
- Log stored with the Trust Center source; no ad-hoc copies.
- No change is published without a change log entry.

## Emergency Rollback Rules

- Trigger: inaccurate/risky content, misaligned claims, or legal/compliance request.
- Action: revert to last Approved version; mark current as Deprecated.
- Authority: Compliance Owner or Legal can initiate; post-mortem required.

## Review Cadence

- Quarterly minimum review by Compliance to ensure alignment with controls and SOC-2 artifacts.
- Additional reviews on trigger events: control change, contract change, audit feedback, objection patterns.

## Change Approval Checklist (Pre-Publish)

- [ ] Draft reviewed by Compliance.
- [ ] Legal reviewed (if contract/non-guarantees affected).
- [ ] Change log entry completed (what/why/who/date).
- [ ] Version/date updated on public page.
- [ ] No new claims, no SLAs, no certifications promised.
- [ ] Rollback plan noted.

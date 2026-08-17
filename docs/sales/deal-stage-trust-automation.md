# Deal-Stage Trust Automation — Security Pack

Deterministic mapping of artifacts by deal stage. No discretionary oversharing.

## Stage → Allowed Artifacts

| Stage               | Allowed Artifacts                                                     | Hard Stops                                                                | Escalation Triggers                                                                               |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Discovery           | Trust Center public copy; FAQ                                         | No compliance packet; no questionnaire; no pricing/SLAs/roadmap           | If buyer requests deep security answers → move to Security Review                                 |
| Security Review     | Trust Center; summary Q&A; diagram (if applicable)                    | No compliance packet by default; no custom promises                       | If buyer requests full Q&A → share final questionnaire; if evidence demanded → involve Compliance |
| Procurement         | Final procurement questionnaire; Trust Center link                    | Do not send compliance packet unless requested; no custom formats or SLAs | If buyer requests evidence packet/SOC-2 readiness → escalate to Compliance                        |
| Legal               | Positioning/contract notes (internal use); Trust Center for reference | No new terms without Legal; no SLAs; no self-service promises             | Any amendments/exceptions → Legal ownership                                                       |
| Audit Follow-Up     | Trust Center (audit/data handling); SOC-2 readiness/Q&A on request    | Do not promise certifications; no custom evidence beyond approved exports | Auditor requests artifacts beyond Trust Center → Compliance shares approved packet/readiness      |
| Renewal / Expansion | Trust Center; FAQ; procurement questionnaire if new review            | No new commitments; no roadmap                                            | If new controls requested → Compliance/Legal review                                               |

## Sales Guardrails

- Never send compliance packet by default; only on explicit request and via Compliance.
- No promises: SLAs, certifications, custom exports, self-service toggles.
- Use Trust Center language verbatim; no paraphrasing controls.
- Hard stops are enforced regardless of deal pressure.

## Escalation Decision Tree (Conceptual)

1. Buyer asks for more than Trust Center?
   - If Q&A depth → provide final procurement questionnaire.
   - If evidence packet/readiness → escalate to Compliance.
2. Buyer requests contract/terms changes?
   - Escalate to Legal; Sales does not commit.
3. Buyer requests custom controls/exports/SLAs?
   - Decline; reiterate standard posture; escalate to Compliance/Legal only for formal position.
4. Auditor asks for certification?
   - Clarify alignment, no certification promises; offer readiness materials via Compliance.

## CRM Flags (Conceptual)

- Stage flags: Discovery, Security Review, Procurement, Legal, Audit, Renewal.
- Artifact sent flags: Trust Center shared, Questionnaire shared, Compliance packet shared (requires Compliance approval), Readiness shared (requires Compliance).
- Escalation flags: Legal involved, Compliance involved.

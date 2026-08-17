# Deal-Stage Compliance Automation — Security Pack

Trust Center first; no auto-sharing compliance packets; no stage skipping.

## Deal-Stage Matrix (Artifact Recommendations)

| Stage               | Auto-Recommended Artifact                                | Hard Stops                                                           | Escalation                                                       |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Discovery           | Trust Center link/copy                                   | No questionnaire, no compliance packet, no SLAs/roadmap              | If buyer requests deep security detail → move to Security Review |
| Security Review     | Trust Center + summary Q&A (if needed)                   | No compliance packet unless explicitly requested; no custom promises | If detailed Q&A requested → share final questionnaire            |
| Procurement         | Final procurement questionnaire                          | Do not auto-send compliance packet; no custom formats/SLAs           | If evidence packet/SOC-2 asked → Compliance approval             |
| Legal               | Positioning/contract notes (internal)                    | No new terms without Legal; no self-service promises                 | Legal owns any amendments/exceptions                             |
| Audit Follow-Up     | Trust Center (audit/data handling); readiness on request | No certification promises; no custom evidence                        | Compliance provides readiness/packet only on request             |
| Renewal / Expansion | Trust Center; questionnaire if re-review                 | No new commitments; no roadmap                                       | Escalate new control requests to Compliance/Legal                |

## CRM Webhook Spec (Conceptual)

- Trigger: Deal stage change.
- Inputs: dealId, workspaceId (if known), stage (enum), requestor (userId).
- Action: Recommend artifact(s) per matrix; log recommendation; do NOT auto-send compliance packet.
- Escalation flag: set when stage requires Compliance/Legal approval (e.g., packet/readiness, amendments).
- Audit: Log recommendation + user who sends; no payload contents stored.

## Sales Ops Runbook

1. On stage change, CRM surfaces recommended artifact (Trust Center by default).
2. Sales/SE sends recommended artifact; if packet/readiness is requested, obtain Compliance approval.
3. If Legal terms or exceptions are requested, route to Legal; Sales cannot commit.
4. Never auto-share compliance packet; always start with Trust Center and questionnaire as appropriate.
5. Record what was sent in CRM notes; maintain stage discipline (no skipping).

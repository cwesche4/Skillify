# SOC-2 Live Interview Simulation — Security Pack

Evidence-only responses; no hypotheticals or future statements.

## Auditor Persona Questions & Answers

| Question                                | Allowed Answer                                                                                                               | Artifact to Show                                                     | What NOT to Say                                        | Pause & Escalate                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| How is access controlled?               | Contract-based entitlements enforced server-side on every route; no self-service activation.                                 | Trust Center (Access Control); Entitlement enforcement summary       | No plan/sku toggles; no promises of UI switch          | If auditor asks for non-standard access or UI toggles   |
| How are approvals enforced?             | Approvals append audit events; delivery requires approval + entitlement; no editable status fields.                          | Trust Center (Approvals & Governance); Timeline API description      | No guaranteed approvals; no manual overrides           | If auditor requests bypass or guarantees                |
| Can audit logs be altered?              | No. Audit logs are append-only; entries are not edited/deleted; timelines are read-only.                                     | Trust Center (Audit Logging & Integrity); SOC-2 narrative            | No claims of crypto immutability beyond append-only DB | If auditor demands cryptographic proofs not in scope    |
| How is evidence access controlled?      | Downloads require entitlements and delivery events; unauthorized/undelivered return 404/403; URLs not stored.                | Trust Center (Data Handling); Procurement Q&A (Incident/Access)      | No custom access models; no permanent links            | If auditor asks for stored URLs or custom sharing       |
| How are exceptions/expirations handled? | Entitlements/Exceptions are time-bound with effective/expiry; resolver excludes expired entries; audit history retained.     | Trust Center (Access); Entitlement audit log doc                     | No open-ended exceptions; no backdating promises       | If auditor asks to backdate or ignore expiry            |
| How are automations secured?            | Scoped service tokens, hashed, constant-time compared; idempotent callbacks; tokens revocable/rotatable.                     | Trust Center (Automation); Service token auth doc                    | No unscoped tokens; no custom automation promises      | If auditor requests plaintext tokens or unscoped access |
| How do customers verify?                | Read-only entitlements/history and timelines; exports on request; no mutation.                                               | Trust Center (Transparency); Procurement Q&A (Customer Transparency) | No editable access; no live data feeds                 | If auditor asks for editable logs or live feeds         |
| SOC-2 alignment?                        | Logical access via entitlements (CC6); append-only audits (CC7/CC7.3); scoped automation (CC7.2); no certification promised. | Trust Center (Non-Guarantees); SOC-2 narrative                       | No claims of certification or SLAs                     | If auditor demands certification guarantees             |

## Red-Flag List (Failure Conditions)

- Offering self-service toggles or plan-based access.
- Promising approvals, SLAs, certifications, or custom exports.
- Agreeing to mutable logs or stored evidence URLs.
- Backdating or open-ended exceptions.
- Providing internal/gated docs without request/approval.

## Pause & Escalate Moments

- Requests for non-standard access, bypasses, or guarantees.
- Demands for cryptographic proofs beyond append-only guarantees.
- Requests for certification promises.
- Requests for stored URLs or editable audit records.

## Answer Key Usage

- Read answers verbatim; show the mapped artifact; avoid paraphrasing controls.
- If pressured beyond allowed answers, pause and escalate to Compliance.

# Sales Promise Guardrails — Security Pack

Trust Center is the ceiling. No promises beyond approved language.

## Forbidden Statements

- “We can customize controls/exports for you.”
- “We guarantee approval/timelines/SLAs.”
- “We can turn this on via a toggle/UI.”
- “We are certified” (only alignment is stated).
- “We’ll add this later” (no roadmap promises).
- Any private assurance not reflected in Trust Center or approved artifacts.

## Allowed vs Forbidden (Mapped to Trust Center)

| Topic      | Allowed (use verbatim)                                                                                                             | Forbidden                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Access     | “Access is contract-entitled and enforced server-side; no self-service activation.” (Trust Center: Access)                         | “We can just turn it on.”                           |
| Approvals  | “Approvals are role-gated and recorded as append-only events; delivery requires approval + entitlement.” (Trust Center: Approvals) | “We guarantee approval” / “We can bypass approval.” |
| Audit      | “Audit logs are append-only and read-only.” (Trust Center: Audit Integrity)                                                        | “We can edit or remove logs.”                       |
| Downloads  | “Downloads require entitlement + delivery; unauthorized returns 404/403.” (Trust Center: Data Handling)                            | “We can give you a direct link without conditions.” |
| Exports    | “Exports are read-only snapshots generated on demand.” (Trust Center: Data Handling/Transparency)                                  | “We can build custom formats or live feeds.”        |
| Compliance | “SOC-2 alignment without certification promises.” (Trust Center: Non-Guarantees)                                                   | “We are certified” / “We guarantee certification.”  |

## Escalation Decision Tree

- Buyer asks beyond scope (custom controls, SLAs, certifications, toggles):
  - Respond with Trust Center language; state we do not offer custom/SLAs/certifications.
  - If buyer insists, escalate to Compliance/Legal; do not promise.
- Buyer requests contract changes: escalate to Legal; Sales cannot commit.
- Buyer asks for evidence packet/readiness: escalate to Compliance; do not send by default.

## Sales Violation Examples (Training Only)

- Promised: “We’ll guarantee approval timelines.” → Violation (implied SLA).
- Promised: “We can store URLs for easy access.” → Violation (contradicts data handling).
- Promised: “We can enable this per user on demand.” → Violation (contradicts contract entitlements).
- Promised: “We’ll add custom audit fields for you.” → Violation (customization promise).

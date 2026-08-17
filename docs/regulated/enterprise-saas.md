# Enterprise SaaS Buyer Template — Security Pack

Framing for general enterprise SaaS buyers. Controls unchanged.

- Access: contract-entitled; no self-service toggles.
- Approvals: role-gated; append-only audit events; delivery requires approval + entitlement.
- Audit: append-only; metadata-only; timelines are read-only.
- Downloads: entitlement + delivery event; unauthorized/undelivered return 404/403; URLs not stored.
- Automation: scoped service tokens; idempotent callbacks; revocable/rotatable.
- Non-guarantees: no SLAs, no certification promises, no custom exports.

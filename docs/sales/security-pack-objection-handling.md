# Security Pack — Enterprise Objection Handling

Deterministic, procurement-safe responses. No promises, pricing, or roadmap.

## 1) Procurement

- **Objection:** “Why isn’t this self-service?”  
  **Response:** Access is contract-entitlement based and enforced server-side to keep evidence delivery governed and auditable. Self-service toggles would bypass the contract and audit controls we enforce for all Enterprise customers.  
  **Evidence:** `docs/security-pack/entitlement-enforcement-final.md`; Trust Center copy.  
  **What not to say:** Don’t imply we can “turn it on” via UI or bypass entitlements.

- **Objection:** “Why can’t we toggle this on?”  
  **Response:** Entitlements are granted via contract, not UI switches. This ensures approvals, audit logging, and download gating stay consistent and reviewable.  
  **Evidence:** Contract packaging decision; entitlement resolver description.  
  **What not to say:** No promises of quick UI toggles or exceptions on demand.

## 2) Security

- **Objection:** “How do we know approvals can’t be bypassed?”  
  **Response:** Approvals append audit events; there are no editable status fields. Delivery requires APPROVED events plus entitlements; unauthorized attempts return 403/404.  
  **Evidence:** `GET /api/security-pack/request/:id`; approval inbox doc.  
  **What not to say:** Don’t guarantee approvals; don’t suggest manual overrides.

- **Objection:** “How do you prevent tampering?”  
  **Response:** Audit logs are append-only and metadata-only; entries are not edited or deleted. Downloads aren’t stored; URLs are generated on demand.  
  **Evidence:** SOC-2 narrative; evidence index.  
  **What not to say:** No claims of cryptographic immutability beyond append-only DB controls.

## 3) Legal

- **Objection:** “Is this contractually enforced?”  
  **Response:** Yes. Access is defined by contract entitlements; routes enforce entitlements on every request. No plan-name shortcuts or UI switches.  
  **Evidence:** Contract packaging decision; entitlement enforcement summary.  
  **What not to say:** Don’t discuss pricing or non-standard terms.

- **Objection:** “What happens if an exception expires?”  
  **Response:** Exceptions are time-bound; when `expiresAt` passes, the resolver no longer grants the entitlement. History remains in the append-only audit log.  
  **Evidence:** Entitlement audit log doc; resolver description.  
  **What not to say:** Don’t promise indefinite exceptions or backdated changes.

## 4) Audit

- **Objection:** “Can we export evidence?”  
  **Response:** Yes—read-only exports (e.g., entitlement history CSV, request timelines) are available on demand after delivery is recorded.  
  **Evidence:** Compliance packet; entitlement history API; timeline API.  
  **What not to say:** Don’t promise custom formats or real-time feeds.

- **Objection:** “Are logs mutable?”  
  **Response:** No. SecurityPackAuditEvent and EntitlementAuditEvent are append-only; no update/delete paths.  
  **Evidence:** SOC-2 evidence index; audit schemas.  
  **What not to say:** Don’t imply we can edit or remove records.

## 5) Competitive

- **Objection:** “Why is this not a separate SKU?”  
  **Response:** Security Pack is included in Enterprise to keep governance consistent and reduce procurement friction. Entitlements are standard for Enterprise contracts, avoiding fragmented controls.  
  **Evidence:** Positioning decision (final).  
  **What not to say:** No pricing/discount talk; don’t suggest it can be sold standalone.

- **Objection:** “Why is this included in Enterprise?”  
  **Response:** Uniform entitlements simplify enforcement, auditability, and evidence reuse across all Enterprise customers, reducing legal and operational risk.  
  **Evidence:** Positioning decision; contract packaging spec.  
  **What not to say:** Don’t promise future carve-outs or upsell variants.

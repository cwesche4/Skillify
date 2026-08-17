# Security Pack Enterprise Battlecards

## 1) What It Is (One Sentence)

Governed, audited, entitlement-enforced delivery of security evidence for Enterprise customers — not a feature toggle.

## 2) Why It Exists (Buyer Framing)

- Reduces procurement friction by standardizing security evidence delivery.
- Provides audit-ready transparency with append-only timelines and exports.
- Eliminates custom security back-and-forth by using contract entitlements and read-only APIs.

## 3) Top Buyer Objections & Responses

- **“Can we self-enable this?”**  
  No. Access is contract-entitlement based and enforced server-side; there are no self-service toggles.
- **“Is approval guaranteed?”**  
  No. Approvals follow reviewer policies; delivery requires APPROVED events plus entitlements.
- **“How do we verify access?”**  
  Read-only APIs show current entitlements and history; timelines show request/approval/delivery events.
- **“Is this a SKU or add-on?”**  
  It is an Enterprise governance module controlled by contract entitlements, not a standalone SKU toggle.
- **“What stops data leakage?”**  
  Downloads require delivery events and entitlements; unauthorized or undelivered access returns 404; URLs are not stored in audit records.

## 4) Proof Points (Evidence-Backed)

- Append-only audit logs for requests, approvals, deliveries, and entitlements.
- Entitlement enforcement on every route; no plan-name branching or self-service.
- Read-only exports (entitlement history CSV, timelines) for auditors and customers.
- 404 concealment for unauthorized/undelivered downloads; no stored URLs.

## 5) What Not to Say (Red Lines)

- Do not promise SLAs or delivery timelines.
- Do not guarantee approval outcomes or audit certifications.
- Do not describe it as self-service or as a pricing/SKU toggle.
- Do not imply roadmap/future controls.

## 6) When to Loop In Security / Legal

- Regulated or high-assurance customers (financial services, healthcare, public sector).
- NDA or exception requests for evidence delivery.
- Requests to alter entitlement scopes or approval policies.
- Questions about incident handling, token rotation, or contract amendments.

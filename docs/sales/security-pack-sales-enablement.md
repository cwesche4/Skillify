# Security Pack & Entitlements — Sales Enablement (Enterprise)

## 1) What the Security Pack Is

- A governed workflow for delivering security evidence (e.g., SOC 2 packet, audit CSV) with auditability, approvals, and server-side controls.
- It is not an autonomous AI feature and not a standalone product; it lives within Enterprise contracts.

## 2) How Access Is Granted

- Access is granted by Enterprise contracts via entitlements, not via UI switches or self-service.
- Entitlements are enforced server-side; requests, approvals, downloads, and audit feeds all check contract entitlements plus workspace membership.
- Human approvals (Security/Legal/GRC) may be required before delivery.

## 3) What Entitlements Mean

- Entitlements represent contract-granted capabilities (e.g., request, download, approval inbox, audit feed).
- They are not feature flags customers can toggle; backend enforcement is authoritative.
- Exceptions or amendments are captured contractually and honored by the entitlement resolver.

## 4) What Is Explicitly Not Promised

- No delivery timelines or SLAs are promised.
- No guarantee that requests will be approved; approvals follow documented reviewer policies.
- No guarantees about audit outcomes; exports are snapshots generated at the time of delivery.

## 5) How Customers Verify Access

- Customers can view entitlements via read-only API/views provided by the platform (contract-driven).
- Audit timelines are immutable and show request/approval/delivery events.
- Exports become available only after delivery is recorded; links are resolved server-side and not stored.

## Do / Don’t Guidance

- **Do** explain that Security Pack access is contract-based and enforced by entitlements.
- **Do** note that approvals and deliveries are audited and append-only.
- **Do** state that exports are generated on demand after delivery is marked.
- **Don’t** quote pricing, timelines, or SLAs.
- **Don’t** imply self-service activation or UI-only control.
- **Don’t** promise approval outcomes or future roadmap changes.

## FAQ-Style Objections & Safe Responses

- **“Can we turn this on ourselves?”** Access is contract-based and enforced by entitlements; there is no self-service toggle.
- **“Will our requests always be approved?”** Approvals follow documented reviewer policies; approval is not guaranteed.
- **“Do you store evidence links?”** Links are resolved on demand after delivery; URLs are not stored in audit records.
- **“How do we verify controls?”** Read-only entitlement views, immutable audit timelines, and post-delivery exports provide verification; denial responses are server-enforced.
- **“Is this a separate SKU?”** No. It is an Enterprise module governed by contract entitlements, not a standalone SKU.

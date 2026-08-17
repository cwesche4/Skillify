# Security Pack Trust Center FAQ

Public-facing answers in Trust Center–safe language.

- **Is Security Pack self-service?**  
  No. Access is granted through contract entitlements and enforced server-side. There is no self-service activation. (See Trust Center: Access Control)

- **How are approvals enforced?**  
  Requests may require human reviewers. Approvals are recorded as audit events, and delivery happens only after approval and entitlement checks. (See Trust Center: Approvals & Governance)

- **Can audit logs be changed or deleted?**  
  No. Audit logs are append-only; entries are not edited or deleted. Timelines are read-only and ordered. (See Trust Center: Audit Logging & Integrity)

- **How are downloads controlled?**  
  Downloads require active entitlements and a recorded delivery event. Unauthorized or undelivered attempts return “not found” or “forbidden” to avoid revealing existence. (See Trust Center: Data Handling)

- **What happens when access expires?**  
  Entitlements follow contract terms and expirations. When they expire, access is removed automatically and downloads remain unavailable until renewed. (See Trust Center: Access Control)

- **Can we export evidence?**  
  Yes. Read-only exports (such as timelines or history snapshots) are available on demand after delivery is recorded. Exports are point-in-time, not live feeds. (See Trust Center: Customer Transparency)

- **How does this align with SOC-2?**  
  Security Pack uses logical access controls, append-only audit records, and scoped automation consistent with SOC-2 principles. No certification or guarantees are promised. (See Trust Center: Explicit Non-Guarantees)

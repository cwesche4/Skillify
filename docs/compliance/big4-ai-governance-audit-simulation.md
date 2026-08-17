# Big-4 AI Governance Audit Simulation

## Auditor Context

- **Firm perspective:** SOC-2 readiness review focused on AI governance controls (CC6–CC9).
- **Scope assumptions:** AI kill switches, rate limits, audit integrity, incident readiness, and evidence availability. No roadmap or future commitments considered.
- **Risk areas:** Unenforced kill switches, mutable audits, missing integrity hashes, lack of alerts for abnormal AI use, insufficient evidence for auditors.

## Audit Questions (22)

1. Who owns AI governance controls, and how are responsibilities documented?
2. What boundaries define AI usage in the platform?
3. How is the global AI kill switch enforced?
4. How is the workspace AI kill switch enforced?
5. What happens when kill switches are active?
6. Are AI actions enforced server-side or client-side?
7. What is logged for each AI action or denial?
8. How is audit immutability enforced?
9. How are integrity hashes generated and chained?
10. How are undo operations linked to original actions?
11. What is the rationale for rate limiting, and how is it scoped?
12. What user feedback is provided on rate-limit events?
13. How are abnormal AI events detected (denials, rate limits, conflicts)?
14. What alerts exist for abnormal AI events?
15. How do you distinguish incident detection from response?
16. How is evidence made available to auditors?
17. Are metrics or alerts free of payload/PII?
18. How is workspace isolation enforced for AI actions and audits?
19. How are readiness checks handled at startup?
20. How is documentation kept consistent with implemented controls?
21. What controls are mapped to SOC-2 CC6/CC7/CC8/CC9?
22. What evidence can be provided under NDA versus public links?

## Management Responses (Evidence-First)

1. Ownership: AI governance controls are documented in Trust Center materials; enforcement resides in server-side guard modules and admin settings pages.
2. Boundaries: AI operates only within a requesting workspace for automation node assistance; no cross-workspace execution (Trust Center AI Governance).
3. Global kill switch: Environment-controlled; enforcement in the server guard that returns 503 when set (AI Governance readiness packet).
4. Workspace kill switch: Workspace setting (`aiActionsEnabled`) enforced server-side before actions run; admin-only toggle (Trust Center AI governance, settings UI).
5. When active: AI endpoints return explicit errors; no actions performed; denials are logged with reasons (readiness packet, Trust content).
6. Enforcement: AI actions validated on the server; clients cannot bypass kill switches or rate limits (Trust landing).
7. Logging: Audits include before/after snapshots, actor/workspace IDs, reasons, timestamps, undo links (readiness packet).
8. Immutability: `AiActionAudit` is append-only; no update/delete flows; integrity hashes stored with each record (readiness packet).
9. Integrity hashing: Hash computed at insert using workspaceId, action, before/after hashes, previous hash; evidence in audit integrity docs.
10. Undo linking: `undoOfId` links undo entries to original actions; conflicts return 409 (readiness packet).
11. Rate limiting: Workspace+user scoped to prevent abuse; documented in rate-limit module and Trust pages.
12. User feedback: 429 responses include `retryAfterMs`; denials include clear messages (Trust Center copy).
13. Detection: Metrics emit attempted/applied/denied/undone/rate-limited events; alerts track denial spikes, rate-limit spikes, undo conflicts (observability docs).
14. Alerts: Threshold-based alerts logged as `[ai-alert]`; thresholds in the alerts module (no payloads).
15. Detection vs response: Detection via metrics/alerts; response guided by runbooks/tabletops; AI can be halted globally or per workspace during investigation (runbook/tabletop docs).
16. Evidence: Audit CSV export, evidence bundle ZIP, SOC-2 readiness packet, control registry, auditor walkthrough (compliance docs).
17. PII handling: Metrics/alerts exclude payload contents by design; audits contain governance snapshots, not used for analytics (AI safety/trust docs).
18. Isolation: AI endpoints require workspace context and membership; audits store workspaceId to maintain isolation (Trust Center).
19. Startup checks: Safety check validates global kill env presence, audit table reachability, and rate limiter readiness before processing AI actions (startup safety description).
20. Documentation consistency: Trust Center, readiness packet, and control registry reflect implemented controls; no roadmap statements.
21. SOC-2 mapping: Controls map to CC6/CC7/CC8/CC9 in the SOC-2 readiness packet and control registry; Vanta/Drata mapping available.
22. Evidence access: Public Trust materials are available; workspace-specific exports and control registry details are provided under NDA upon request.

## Evidence Requests (Typical)

- Audit CSV export sample with integrityHash and wasDenied fields (per workspace, under NDA).
- Evidence bundle ZIP (workspace-specific).
- SOC-2 readiness packet and control registry (docs).
- Log samples showing `[ai-metric]` and `[ai-alert]` entries (redacted for payload/PII).
- Runbook and tabletop exercise documents (public).

## Likely Audit Outcome

- **Findings:** None expected if evidence is provided; possible observation to document retention expectations if not already stated.
- **Management action items:** Provide sample export; confirm retention policy; demonstrate disable/enable flow in a test workspace.
- **Next-cycle monitoring:** Verify integrity hashes remain present; ensure alerts continue to fire on abnormal patterns; confirm documentation aligns with current controls.

# Enterprise Security Review Simulation — AI Governance

## 1) Reviewer Context

- **Industry:** Fintech SaaS.
- **Risk tolerance:** Moderate-high; requires provable controls for AI use.
- **Primary concerns:** Ability to disable AI quickly, audit integrity, isolation by workspace, and SOC-2-aligned evidence.

## 2) Security Review Questions (18)

1. How is AI used and where does it run?
2. Can AI be disabled globally and per workspace? What response is returned?
3. Are AI actions enforced server-side, or can clients bypass controls?
4. Who can change the workspace AI toggle?
5. How are AI actions audited? What data is captured?
6. How is audit integrity protected against tampering?
7. How are undo operations tracked and protected from conflicts?
8. How do you prevent abusive or excessive AI calls?
9. What happens when rate limits are exceeded?
10. How are kill switch denials surfaced to users and logged?
11. Do metrics or alerts include payload contents or PII?
12. What monitoring or alerts exist for abnormal AI usage?
13. How do you respond to AI-related incidents or alerts?
14. Can customers export AI audit data themselves?
15. What evidence is available for auditors (SOC-2 context)?
16. How is workspace isolation enforced for AI actions and audits?
17. Is there a readiness check at startup to ensure safeguards are present?
18. What documentation can we review without engineering assistance?

## 3) Vendor Responses

1. AI assists with automation node configuration inside each workspace; actions are scoped to that workspace and user context (Trust Center AI Governance).
2. Yes. A platform env kill switch and a per-workspace toggle stop AI; endpoints return explicit errors and perform no actions when disabled (Trust landing; readiness packet).
3. AI actions are server-enforced; clients cannot bypass kill switches or rate limits (Trust Center copy; readiness packet).
4. Workspace admins/owners can change the toggle; the setting is enforced server-side (AI Actions settings page; readiness packet).
5. Audits record before/after snapshots, actor/workspace IDs, reasons, timestamps, and undo links (readiness packet; customer AI security overview).
6. Each audit includes an integrity hash; logs are append-only and chained for tamper evidence (readiness packet integrity section).
7. Undo operations link to the original action via undoOfId and reject when snapshots conflict, returning 409 (readiness packet).
8. Workspace/user rate limits apply; structured metrics and alerts highlight spikes (Trust Center security controls; readiness packet).
9. Exceeding limits returns HTTP 429 with retryAfterMs; rate-limit events appear in metrics/alerts (Trust Center controls).
10. Kill switch denials return 403/503 with clear messaging; denials are logged with wasDenied and reason (AI governance pages; readiness packet).
11. Metrics and alerts exclude payload contents and PII by design (AI safety overview; questionnaire answers).
12. Metrics cover attempted/applied/denied/undone/rate-limited events; alerts fire on denial spikes, rate-limit spikes, undo conflicts (readiness packet).
13. Runbooks and tabletop exercises guide response; AI can be halted globally or per workspace while investigating (runbook; tabletop doc).
14. Yes. CSV export and the evidence bundle provide audit data with metadata for the customer’s workspace (readiness packet; evidence bundles).
15. SOC-2 alignment is documented in the AI governance readiness packet, control registry, and Vanta/Drata mapping (compliance docs).
16. AI endpoints require workspace context and membership; audits are stored with workspaceId to maintain isolation (Trust Center; readiness packet).
17. Startup safety checks ensure required env, audit table reachability, and rate limiter readiness before processing AI actions (startup safety description).
18. Public Trust Center content, AI governance summary, readiness packet, trust brief, and procurement deck are available without engineering involvement (trust and sales docs).

## 4) Follow-Up Questions

- Provide a sample audit CSV row showing integrityHash and wasDenied.
- Demonstrate a 429 rate-limit response and corresponding alert entry.
- Confirm audit retention expectations (append-only; duration policy if defined).
- Walk through the global and workspace disable steps from the runbook.
- Clarify customer steps when alerts or rate limits occur.

## 5) Review Outcome

- **Likely outcome:** Conditional approval pending sample audit export and short disable/enable dry run in a test workspace.
- **Conditions:** Confirmation of audit retention expectations and visibility into rate-limit/alert signals for the customer workspace.
- **Typical red flags:** Lack of sample evidence or unclear disablement steps can delay approval; payload logging would be a blocker (not present here).

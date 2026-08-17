# AI Governance Changelog

Chronological notes on governance-related changes. Documentation only—no automation here.

- **2025-02-XX** — Added AI action integrity hashes and evidence bundle export. Risk: tampering concerns; Behavior change: audit rows now include integrityHash, exports include metadata footer.
- **2025-02-XX** — Introduced global AI actions kill switch (env) and workspace admin UI toggle. Risk: emergency shutdown and misconfiguration control; Behavior change: AI endpoints return 503/403 when disabled.
- **2025-02-XX** — Added rate limiting, alerts, and abnormal-usage detection for AI actions. Risk: abuse/spikes; Behavior change: 429 responses when limits exceeded; alerts on denials/rate limits/undo conflicts.
- **2025-02-XX** — Added AI action audit query/export endpoints with server-side filtering. Risk: lack of visibility; Behavior change: read-only audit access and CSV export with footer metadata.
- **2025-02-XX** — Added undo conflict detection and audit chaining. Risk: unintended undo overwrites; Behavior change: 409 on conflicts, linked audits via undoOfId.
- **2025-02-XX** — Added startup self-check and governance self-audit. Risk: missing safeguards at boot; Behavior change: fail-fast on missing env/tables; read-only drift checks.

# AI Governance Summary (Executive)

**What AI can do:** Assist with configuring automation nodes and provide suggestions within a workspace. All actions are logged and tied to a workspace and user.

**What AI cannot do:** It cannot bypass server controls, modify data without approval, or run if disabled. It does not store or emit payload contents in metrics or alerts.

**How it’s controlled:** Operators have a global kill switch; workspace admins have a workspace kill switch. Rate limits and membership checks prevent abuse. Every AI action (or denial) is recorded with integrity hashes and can be exported for review.

**How incidents are handled:** Alerts fire on abnormal patterns (denials, rate limits, undo conflicts). Runbooks guide on-call response. Exports and audits allow rapid investigation. AI can be disabled instantly at workspace or platform level if needed.

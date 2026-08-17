# Customer AI Security Overview

## 1. How AI Is Used

AI helps configure automation steps and suggest improvements inside your workspace. All AI actions are tied to your workspace and user context.

## 2. How AI Is Controlled

AI actions are enforced on the server and scoped to your workspace. A platform-wide kill switch and a per-workspace toggle can stop AI actions instantly, returning clear errors instead of acting.

## 3. Auditability & Transparency

Every AI action (including denials) is logged with before/after snapshots and tamper-evident integrity hashes. You can download audit records as CSV or as part of an evidence bundle with metadata.

## 4. Abuse Prevention

Workspace- and user-level rate limits prevent excessive use and return retry guidance. Abnormal patterns—like repeated denials or undo conflicts—generate alerts without exposing your data or payloads.

## 5. Incident Handling

Runbooks and tabletop exercises guide operators through global disables, rate-limit spikes, and audit reviews. If needed, AI can be halted at the workspace or platform level while investigations proceed.

## 6. What Customers Can Control

- Enable or disable AI actions for a workspace.
- Export audit records for your own review.
- Work with support to address rate-limit issues or investigate alerts.

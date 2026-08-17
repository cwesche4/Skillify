# Enterprise Capability Matrix (Internal)

Single source of truth for monetizable capabilities. Internal use only; no pricing, no customer-facing language.

## Capability → Entitlement Mapping

- Security Pack request creation → `SECURITY_PACK_REQUEST`
- Security Pack download resolution → `SECURITY_PACK_DOWNLOAD`
- Security Pack approval inbox → `SECURITY_PACK_APPROVAL_INBOX`
- Workspace audit feed → `WORKSPACE_AUDIT_FEED`
- Premium AI nodes → `PREMIUM_AI_NODES`
- Automation templates (enterprise set) → `ENTERPRISE_TEMPLATES`
- Service token callbacks (delivery/entitlements) → `SERVICE_TOKEN_AUTOMATION`

## Soft-Limit Thresholds (Non-blocking, informational)

- Runs/day: 500
- AI node executions/day: 2,000
- Tokens/day: 5,000,000

## Audit Impact Notes

- All Security Pack routes append audit events; downloads are concealment-aware (404 on unauthorized).
- Entitlement mutations are append-only via `EntitlementAuditEvent`; system-token gated.
- Automation execution timelines are append-only; replay is read-only.
- Usage warnings emit informational events only; no blocking.

## Risk Classification (Internal)

- Security Pack delivery: High (data exposure potential) — entitlement + approval required.
- Entitlement admin: High — system-token only, append-only audit.
- Premium AI nodes: Medium — visibility gated; execution unchanged for existing flows.
- Automation templates: Medium — read-only until cloned; no auto-execution.
- Usage telemetry: Low — informational; no enforcement.

## Validation Checklist

- [ ] Required entitlements exist for each capability.
- [ ] Server-side checks reference entitlements, not plan names.
- [ ] Audit events append-only; no status mutations.
- [ ] Soft-limit warnings are informational and non-blocking.
- [ ] Concealment rules applied on sensitive routes (404 on unauthorized).
- [ ] Documentation aligns with Trust Center language; no pricing or SLA references.

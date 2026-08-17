# Security Pack Change Management Guardrails

Prevent weakening of guarantees; explicit, reviewable guardrails.

## Changes Requiring Compliance Review

- Any change to entitlements/resolver behavior (scopes, precedence, effective/expiry handling).
- Any change to approval logic, reviewer roles, or separation of duties.
- Any change to audit events/tables (fields, mutability, ordering).
- Any change to download/artifact gating or concealment (404/403).
- Any change to automation callbacks/token scopes or idempotency.
- Any change to Trust Center language, non-guarantees, or public claims.

## Forbidden Changes (Red Lines)

- Introducing plan-name/SKU branching for entitlements.
- Adding UI toggles/self-service activation.
- Allowing mutable audit logs or deleting audit events.
- Storing evidence payloads/URLs in audit tables.
- Bypassing approval/entitlement checks or adding auto-approval.
- Relaxing concealment (e.g., exposing unauthorized/undelivered existence).
- Adding SLAs, certification promises, or custom guarantees in code or docs.

## PR Checklist (Security Pack Impact)

- [ ] Entitlements/resolver unchanged or reviewed by Compliance.
- [ ] No plan/SKU branching added.
- [ ] Approvals remain append-only; no self-approval; roles unchanged or approved.
- [ ] Audit events remain append-only; no mutability introduced; ordering preserved.
- [ ] Downloads/artifacts still require entitlement + delivery; concealment intact.
- [ ] Automation callbacks remain scoped/tokenized and idempotent; no unscoped access.
- [ ] Trust Center/public claims unaffected, or Compliance approved changes.
- [ ] No storage of payloads/URLs in audit.
- [ ] Rollback plan identified if behavior changes.

## Rollback Requirements

- For any behavior change to enforcement, approvals, audit, downloads, or automation: define a rollback to previous version/state; no data deletes.
- Rollback must preserve audit history (no mutations); use code/config reverts only.
- Document rollback steps in the PR and ensure owners (Engineering + Compliance) are identified.

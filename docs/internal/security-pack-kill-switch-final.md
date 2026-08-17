# Entitlement Kill-Switch & Exception Controls — Final

Objective: Disable entitlements instantly without data mutation or downtime. Resolver-level enforcement only; no UI toggles.

## Kill-Switch Behavior

- **Global kill-switch (AI_ACTIONS_GLOBALLY_DISABLED):** If set, AI/related actions are denied before workspace checks; returns 503 with explicit message. Overrides entitlements and exceptions.
- **Workspace-level kill-switch (aiActionsEnabled=false in WorkspaceSettings):** Default deny unless explicitly enabled; if disabled, deny AI actions regardless of entitlements.
- No data deletes; no audit mutation; enforcement is read-only gating.

## Resolver Precedence Rules

1. Global kill-switch (highest precedence) → deny.
2. Workspace kill-switch → deny.
3. Entitlement resolver (ContractEntitlement + ContractException with expiry) → allow scopes if active.
4. Delivery/approval prerequisites → must be satisfied per route.
5. Concealment: unauthorized/undelivered returns 404/403; no leakage.

## Exception Expiry Enforcement

- ContractException entries include effective/expiry; resolver excludes expired entries automatically.
- No open-ended exceptions; time-bound only; append-only audit records retained.

## Runtime Scenarios

- **Incident response:** Toggle global or workspace kill-switch; resolver denies downstream logic without mutation. Restore by flipping switch off. Audit tables remain intact.
- **Contract termination:** Entitlements/Exceptions expire or are removed via audited mutation; resolver stops granting; kill-switch not required but can be used for immediate deny.
- **Legal hold:** Use kill-switch to deny actions without altering audit data; maintain append-only logs.

## Incident-Ready Checklist

- [ ] Global kill-switch value verified settable/readable.
- [ ] Workspace kill-switch default is deny unless enabled.
- [ ] Resolver excludes expired exceptions and respects precedence.
- [ ] Routes respect kill-switches (deny before further logic).
- [ ] No deletes/mutations performed during kill; audits remain append-only.

# Contract-to-Entitlement Mapping — Security Pack

Contract is the only source of truth. No SKU/plan branching; entitlements are granted by contract clauses.

## Mapping Table

| Contract Clause (conceptual)                       | Entitlement Grant                                                   | Exception Handling                                                          | Expiration Behavior                                                             | Audit Evidence                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Security Pack included for Enterprise workspace(s) | SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD, WORKSPACE_AUDIT_FEED | Exceptions not allowed unless expressly added as time-bound amendment       | Entitlements end at contract/term expiration; resolver excludes expired entries | EntitlementAuditEvent for grants/revokes/expiry; ContractEntitlement/Exception records |
| Approval inbox access (if included)                | SECURITY_PACK_APPROVAL_INBOX                                        | Time-bound exceptions possible via amendment; must specify effective/expiry | Expires per amendment; resolver enforces expiry                                 | EntitlementAuditEvent; ContractException if temporary                                  |
| Automation callbacks permitted (if included)       | SERVICE_TOKEN_AUTOMATION                                            | Exceptions not applicable; tokens issued under scope                        | Tokens remain until revoked; entitlement expires with contract                  | EntitlementAuditEvent; AutomationServiceToken records                                  |
| Custom approval roles (if included)                | CUSTOM_APPROVAL_ROLES                                               | Only if explicitly added; otherwise not granted                             | Expires per contract term; resolver excludes when expired                       | EntitlementAuditEvent; ContractEntitlement                                             |

## Exception Language Patterns (Safe, Non-Legal)

- “Customer is granted [ENTITLEMENT_KEY] from [EFFECTIVE_DATE] to [EXPIRY_DATE]. Upon expiry, access is removed automatically.”
- “Temporary inclusion of [ENTITLEMENT_KEY] is limited to [TERM]; no self-service activation is provided.”
- “No SLAs, certification promises, or self-service toggles are included; all access is entitlement-based.”

## Expiration Behavior

- Entitlements end when contract term or specified expiry ends; resolver excludes expired entries automatically.
- Temporary exceptions require explicit effective/expiry and are tracked as ContractException; no open-ended exceptions.

## Audit Evidence per Clause

- Grants/revokes/expiry → EntitlementAuditEvent entries.
- Current state → ContractEntitlement/ContractException records.
- Access usage → Enforced via `hasWorkspaceEntitlement`; timeline/audit unaffected by entitlement changes except access gating.

## What Sales Must Never Promise

- No self-service activation or toggles.
- No SLAs or certification guarantees.
- No custom entitlements outside explicit contract clauses/amendments.
- No SKU-based or plan-name-based access; contract entitlements only.

## Enforcement Notes (Engineering & Sales)

- Engineering: enforce entitlements via resolver only; no plan-name checks; respect effective/expiry; log changes in EntitlementAuditEvent.
- Sales: reference contract-entitlement mapping; do not imply SKU toggles or future upgrades; all exceptions must be time-bound and contract-documented.

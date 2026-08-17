# Regulated Customer Templates (Security Pack & Entitlements)

Templates guide contract setup; they do not auto-grant access. Enforcement remains entitlement-based.

## Templates

### Healthcare

- Required entitlements: SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD, WORKSPACE_AUDIT_FEED
- Mandatory approvals: Security + Legal before delivery
- NDA enforcement: Required; validation failures logged
- Export restrictions: Delivery only after approvals; download endpoints remain entitlement-gated

### Financial Services

- Required entitlements: SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD, WORKSPACE_AUDIT_FEED, SERVICE_TOKEN_AUTOMATION
- Mandatory approvals: Security before delivery; Legal as needed
- NDA enforcement: Required; validation failures logged
- Export restrictions: Delivery callbacks must be authenticated; download requires delivery event + entitlement

### Government

- Required entitlements: SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD, WORKSPACE_AUDIT_FEED, SECURITY_PACK_APPROVAL_INBOX, CUSTOM_APPROVAL_ROLES
- Mandatory approvals: Security + Legal/GRC; custom roles enabled
- NDA enforcement: Required; no delivery without approval
- Export restrictions: Download only after delivery + entitlement; no stored URLs

### Education

- Required entitlements: SECURITY_PACK_REQUEST, SECURITY_PACK_DOWNLOAD
- Mandatory approvals: Security/Legal required before delivery
- NDA enforcement: Required; validation events logged
- Export restrictions: Delivery-gated downloads; entitlement checks enforced

## Mapping to Entitlements

- Templates specify entitlement sets and approval expectations; actual enforcement uses `hasWorkspaceEntitlement`.
- Approval requirements are policy guidance; backend still requires reviewer approvals where configured.

## Sales + Legal Usage Notes

- Use templates to propose contract terms; entitlements are granted via contract/amendment/exception, not UI toggles.
- Document mandatory approvals and NDA requirements in contract language; ensure entitlement resolver reflects granted keys.
- No automatic activation; customer access begins once entitlements are contractually granted and provisioned.

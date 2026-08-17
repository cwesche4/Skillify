# Enterprise Security Pack Feature Gating

Defines plan-based access for Security Pack functionality. Neutral, non-sales language.

## Feature Matrix

| Feature                                             | Free                       | Pro                         | Enterprise                                  |
| --------------------------------------------------- | -------------------------- | --------------------------- | ------------------------------------------- |
| Request Security Pack                               | Trust Center only (public) | Request (approval required) | Request (approval required)                 |
| Audit CSV export                                    | Not available              | Not available               | Available (approval + NDA, workspace admin) |
| SOC-2 packet access                                 | Not available              | On request (approval)       | Available (approval)                        |
| Approval workflow                                   | N/A                        | Required for any request    | Required for exports/SOC-2                  |
| Immutable logs (delivery metadata)                  | N/A                        | Logged for requests         | Logged for requests/exports                 |
| Admin controls (AI actions toggle, export requests) | Limited                    | Available                   | Available                                   |

## Access Rules

- Free: View public Trust Center content only.
- Pro: May submit Security Pack requests; no audit exports by default; SOC-2 packet only by approval.
- Enterprise: Full request capability; audit CSV and SOC-2 packet available with approval and NDA; admin controls enabled.

## Enforcement Strategy

- **Frontend gating:** Hide or disable request/export controls for plans that do not include them; show neutral messaging when disabled.
- **Backend enforcement:** API checks plan before processing requests or exports; deny with clear error if plan insufficient.
- **Logging:** Log denied attempts (plan checks) for auditability; no payload contents.

## Upgrade Messaging (Neutral)

- “Security evidence exports require the Enterprise plan. Contact your account team to enable.”
- “SOC-2 documentation is available on Enterprise with approval.”

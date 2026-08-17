# n8n Security Pack Workflow Test Cases

Deterministic scenarios to validate node logic before wiring sends.

| Test | Inputs                                                              | Expected Template        | Expected Bundles                                                            | Approval Required           | Failure Conditions                                 |
| ---- | ------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| 1    | industry=fintech, reviewType=security-review, workspaceId=ws1       | fintech template         | AI Governance Evidence Bundle + Audit CSV (ws1)                             | Yes (NDA, workspace export) | Missing workspaceId → omit export, flag in preview |
| 2    | industry=healthcare, reviewType=audit-request, workspaceId=ws2      | healthcare template      | AI Governance Evidence Bundle + Audit CSV (ws2)                             | Yes (NDA, workspace export) | NDA not confirmed → hold                           |
| 3    | industry=saas, reviewType=soc2-escalation, workspaceId=ws3          | saas template            | SOC-2 AI Controls Bundle + AI Governance Evidence Bundle + Audit CSV (ws3)  | Yes (NDA, SOC-2)            | Missing workspaceId → note, omit CSV               |
| 4    | industry=enterprise, reviewType=security-review, workspaceId=none   | enterprise template      | AI Governance Evidence Bundle (no CSV)                                      | Yes (bundle NDA)            | None                                               |
| 5    | industry=public-sector, reviewType=audit-request, workspaceId=ws4   | public sector template   | AI Governance Evidence Bundle + Audit CSV (ws4)                             | Yes (NDA, workspace export) | Workspace mismatch → fail                          |
| 6    | industry=bank/payments, reviewType=soc2-escalation, workspaceId=ws5 | bank/payments template   | SOC-2 AI Controls Bundle + AI Governance Evidence Bundle + Audit CSV (ws5)  | Yes (NDA, SOC-2)            | Missing NDA → hold                                 |
| 7    | industry=unknown, reviewType=security-review, workspaceId=none      | saas template (fallback) | AI Governance Evidence Bundle (no CSV)                                      | Yes (bundle NDA)            | None                                               |
| 8    | industry=fintech, reviewType=incident-request, workspaceId=ws6      | fintech template         | Incident Readiness Bundle + AI Governance Evidence Bundle + Audit CSV (ws6) | Yes (NDA, workspace export) | Missing workspaceId → note, omit CSV               |

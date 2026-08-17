# Security Pack Positioning Decision

Decision between:

- **Option A:** Core Enterprise Differentiator (included by default in every Enterprise contract)
- **Option B:** Regulated Enterprise Module (included only for regulated/high-assurance customers)

## Side-by-Side Comparison

| Dimension                 | Option A — Core Enterprise                                                                                                                      | Option B — Regulated Module                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Sales Impact              | Lower procurement friction; simpler pitch; faster deal velocity for all Enterprise deals; stronger competitive positioning as baseline control. | Higher procurement friction (amendments/add-ons); slower velocity for non-regulated deals; differentiator only for regulated prospects. |
| Legal & Contract Impact   | Fewer amendments; fewer exceptions; lower legal churn; consistent terms across Enterprise.                                                      | More amendments/exceptions to add/remove entitlements; increased legal churn; more exception tracking and expiry handling.              |
| Engineering Impact        | Simpler entitlement mapping (baseline entitlements for all Enterprise workspaces); lower support complexity.                                    | More entitlement combinations; higher support/ops burden; more edge cases for entitlement resolver and history.                         |
| Audit & Compliance Impact | Uniform evidence set across Enterprise; easier evidence reuse; consistent control scope reduces audit cost.                                     | Fragmented control scope; auditors must differentiate customers with/without module; higher audit explanation overhead.                 |
| Long-Term Optionality     | Easier to maintain backward compatibility; simpler migration paths if changing later (already universal).                                       | Migration to “all Enterprise” later requires contract updates and entitlement migrations; risk of inconsistent states.                  |

## Recommendation

Adopt **Option A — Core Enterprise Differentiator** (include Security Pack by default in every Enterprise contract).

## Rationale (Aligned to Current Implementation)

- Entitlement resolver is already contract-driven and can grant a standard bundle to all Enterprise workspaces without plan-name branching.
- Audit/evidence artifacts (timelines, history exports) assume availability; uniform inclusion reduces conditional logic and operational risk.
- Approval inbox, download concealment, and entitlement history are simpler to operate when all Enterprise customers have the same baseline entitlements.
- Compliance packet, Q&A, and SOC-2 evidence are written for consistent Enterprise scope; maintaining two scopes increases audit cost.

## Why Not Option B (Regulated Module Only)

- Increases amendment/exception handling, raising legal and support burden.
- Fragmented evidence scope complicates SOC-2 walkthroughs and procurement questionnaires.
- Entitlement combinations increase operational and migration risk; switching to universal later would require re-contracting and data migrations.
- Competitive positioning weakens for non-regulated Enterprise deals, adding friction without architectural benefit.

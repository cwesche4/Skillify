# Security Pack Commercial Positioning Decision (Final)

Decision options:

- **Option A:** Core Enterprise Differentiator (default in all Enterprise contracts)
- **Option B:** Regulated / High-Assurance Upsell Module

## Side-by-Side Comparison

| Dimension                 | Option A — Core Enterprise                                                                                               | Option B — Regulated Upsell                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Sales Impact              | Lower procurement friction; faster Enterprise deal velocity; consistent differentiation across all Enterprise customers. | Higher procurement friction; slower velocity for non-regulated deals; differentiation limited to regulated prospects. |
| Legal & Contract Impact   | Fewer amendments/exceptions; simpler, consistent contract language.                                                      | More amendments/exceptions to add/remove entitlements; higher contract complexity.                                    |
| Engineering Impact        | Simpler entitlement mapping (baseline bundle for all Enterprise); lower support burden and operational risk.             | More entitlement combinations and edge cases; higher support/operational load; increased resolver complexity.         |
| Audit & Compliance Impact | Uniform control scope and evidence; easier reuse of SOC-2 artifacts; lower long-term audit cost.                         | Fragmented scope; auditors must track which customers have the module; higher audit overhead.                         |
| Strategic Optionality     | Easier to maintain backward compatibility; minimal migration if strategy changes later.                                  | Switching to universal later requires re-contracting and entitlement migrations; risk of inconsistent states.         |

## Recommendation

Adopt **Option A — Core Enterprise Differentiator** (include Security Pack by default in every Enterprise contract).

## Rationale (Tied to Current Implementation)

- Entitlements are already contract-driven and can grant a standard bundle to all Enterprise workspaces without plan-name branching.
- Audit/evidence artifacts (timelines, history exports) assume availability; uniform inclusion avoids conditional operations.
- Approval inbox, download concealment, and entitlement history are simpler to operate and support when all Enterprise customers share the same baseline entitlements.
- Compliance packet, SOC-2 narratives, and procurement Q&A are written for consistent Enterprise scope, reducing audit and sales friction.

## Why Not Option B

- Increases amendment and exception volume, raising legal and support burden.
- Fragmented evidence scope complicates SOC-2 walkthroughs and procurement responses.
- More entitlement permutations elevate operational and migration risk; future shift to universal would require contract and data changes.

## Contract Implications

- Define Security Pack entitlements as part of standard Enterprise contract terms (no SKU toggles).
- Amendments/exceptions are minimal and time-bound; default posture is included-by-default.
- Entitlement resolver remains the source of truth; no UI or plan-name branching.
- Compliance artifacts and evidence exports apply uniformly across Enterprise customers.

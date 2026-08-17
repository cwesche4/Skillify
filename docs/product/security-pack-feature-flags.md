# Security Pack Feature Flags & Rollout Phases

Defines how to phase the Security Pack feature with feature flags.

## Feature Flags

- `securityPack.internal`: Limits access to internal staff for testing.
- `securityPack.beta`: Enables feature for approved beta customers.
- `securityPack.general`: Full release flag (only after criteria met).

## Rollout Phases

- **Internal-only:** `securityPack.internal` on, others off. Test request flow, approvals, logging, and UI copy. No external users.
- **Beta customers:** Enable `securityPack.beta` for selected workspaces/customers. Requires approval policy enforcement, logging, and stable templates/bundles. Monitor for feedback; no change to controls.
- **Full release criteria:** Internal and beta complete; approval/logging/retention policies are followed; UI/UX issues resolved; evidence handling consistent; trust content up to date. Then enable `securityPack.general`.

## Notes

- Feature flags should be mutually exclusive per phase; do not enable general until criteria are confirmed.
- Keep NDA/approval requirements unchanged across phases.

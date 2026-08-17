# Analytics Snapshot Tests (Determinism Contract)

## Purpose

- Enforce immutability and determinism of analytics aggregation helpers.
- Catch any behavioral drift in core read-model functions before it reaches consumers.
- Provide a single source of truth for expected outputs under fixed inputs.

## Files Covered

- `lib/analytics/inspectorAggregates.ts` (all exported helpers)
- Tests: `lib/analytics/__tests__/inspectorAggregates.snapshot.test.ts`
- Snapshots: `lib/analytics/__tests__/__snapshots__/inspectorAggregates.snapshot.test.ts.snap`
- Fixture: `lib/analytics/__tests__/fixtures/inspectorTelemetry.fixture.ts`

## Update Rules

- Snapshots **must only be updated** when the contract of an aggregation helper intentionally changes.
- Any update requires:
  - A documented contract change
  - Review of downstream phases (analytics UI, onboarding, AI Coach, overlays)
- Do **not** regenerate snapshots to “fix” failing tests unless the underlying contract change is intentional and approved.

## Forbidden

- Introducing randomness, time-based logic, or feature-flagged branching into aggregation helpers.
- Depending on external state or environment.
- Mutating inputs or relying on Map insertion order.
- Adding new test paths outside the explicit analytics snapshot suite.

## Determinism Requirements

- Inputs must be static, explicit, and fully in-memory.
- Outputs must be sorted deterministically before snapshotting.
- Re-running tests with identical inputs must yield identical snapshots; outputs must be new objects (no reference reuse).

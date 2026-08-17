/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Notes on how versioning will integrate with runs, collaboration, and rollback.
============================================================================ */

// - Versions are manual snapshots (nodes, edges, viewport, metadata) and do not auto-save.
// - Run Timeline can reference version IDs to show which version produced a given run.
// - Collaboration locks should bind to a version hash to avoid editing stale snapshots.
// - Rollback can be implemented as: fetch snapshot -> hydrate builder state -> manual confirm.
// - No realtime merge: conflicts resolved by explicit restore + save as new version.

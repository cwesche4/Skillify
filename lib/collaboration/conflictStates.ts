/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Conflict resolution state machine (conceptual). No logic or runtime wiring.
============================================================================ */

export type ConflictResolutionState =
  | 'detected' // system flags a conflict; surfaces banner/modal
  | 'acknowledged' // user has seen the conflict notice
  | 'resolving' // user is choosing an action (keep mine / use theirs / fork / cancel)
  | 'resolved' // resolution applied (manual)
  | 'aborted' // user cancelled; may reload or defer

// UX expectations (comments only):
// - detected: soft pause edits; show non-blocking banner/modal.
// - acknowledged: user explicitly opens/reads details.
// - resolving: user picks an explicit path; no auto-merge.
// - resolved: changes applied intentionally; audit-friendly.
// - aborted: no changes applied; user can retry or reload.

/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Lock semantics and escalation notes (no runtime enforcement).
============================================================================ */

export type LockMode = 'soft' | 'hard'

// Soft lock: hover/select/intent. Advisory only, signals someone else is present.
// Hard lock: edit/drag/mutation. Blocks edits when enforced (future).
// Escalation path: soft -> hard on edit/drag; hard -> released on timeout or explicit release.
// Conflict resolution (planned): last-writer-wins for soft; hard prevents writes; overrides require permission.

export function describeLock(mode: LockMode) {
  return mode === 'hard'
    ? 'Hard lock (blocking when enforced)'
    : 'Soft lock (advisory)'
}

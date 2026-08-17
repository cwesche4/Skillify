/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Conflict taxonomy for future collaboration UX. No runtime logic here.
============================================================================ */

export type ConflictSeverity = 'info' | 'warning' | 'blocking'

export type ConflictType = {
  id: string
  label: string
  description: string
  severity: ConflictSeverity
  recommendedAction: 'review' | 'reload' | 'fork' | 'override'
}

export const CONFLICT_TYPES: ConflictType[] = [
  {
    id: 'simultaneous-node-edit',
    label: 'Simultaneous Node Edit',
    description: 'Two users edited the same node at the same time.',
    severity: 'warning',
    recommendedAction: 'review',
  },
  {
    id: 'stale-version-edit',
    label: 'Stale Version Edit',
    description: 'Edits were made on an outdated version of the automation.',
    severity: 'warning',
    recommendedAction: 'reload',
  },
  {
    id: 'hard-lock-violation',
    label: 'Hard Lock Violation',
    description:
      'An edit attempted on a node that is hard-locked by another user.',
    severity: 'blocking',
    recommendedAction: 'override',
  },
  {
    id: 'version-restore-conflict',
    label: 'Version Restore Conflict',
    description: 'A restore was requested while others have pending edits.',
    severity: 'blocking',
    recommendedAction: 'fork',
  },
]

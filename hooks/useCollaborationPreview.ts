'use client'

/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Static collaboration preview; replace with backend data later.
============================================================================ */

import { useMemo } from 'react'
import type { CollaborationSession } from '@/lib/collaboration/types'

type Options = {
  enabled?: boolean
  workspaceId: string
  automationId: string
}

export function useCollaborationPreview({
  enabled = false,
  workspaceId,
  automationId,
}: Options) {
  return useMemo<CollaborationSession>(
    () =>
      enabled
        ? {
            automationId,
            workspaceId,
            collaborators: [
              {
                userId: 'user-1',
                name: 'Alex',
                color: '#38bdf8',
                lastSeenAt: Date.now(),
              },
            ],
            cursors: [
              {
                userId: 'user-1',
                x: 120,
                y: 160,
                viewport: { x: 0, y: 0, zoom: 1 },
                updatedAt: Date.now(),
              },
            ],
            locks: [
              {
                nodeId: 'node-1',
                lockedBy: 'user-1',
                mode: 'soft',
                since: Date.now(),
              },
            ],
          }
        : {
            automationId,
            workspaceId,
            collaborators: [],
            cursors: [],
            locks: [],
          },
    [enabled, automationId, workspaceId],
  )
}

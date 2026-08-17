'use client'

/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Static versioning preview; replace with backend data later.
============================================================================ */

import { useMemo } from 'react'
import type { AutomationVersion } from '@/lib/versioning/types'

type Options = {
  enabled?: boolean
  automationId: string
}

export function useVersioningPreview({
  enabled = false,
  automationId,
}: Options) {
  return useMemo<AutomationVersion[]>(
    () =>
      enabled
        ? [
            {
              id: 'v1',
              automationId,
              workspaceId: 'workspace-1',
              label: 'Initial snapshot',
              createdAt: Date.now() - 86_400_000,
              createdBy: 'user-1',
              snapshot: {
                nodes: [],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 },
              },
            },
          ]
        : [],
    [enabled, automationId],
  )
}

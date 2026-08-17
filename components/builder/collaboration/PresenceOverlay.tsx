'use client'

/* ============================================================================
   POINTER-EVENTS-NONE — READ-ONLY OVERLAY
   Backend-driven presence visualization (polling-first). No interactions.
============================================================================ */

import type { CollaborationSession } from '@/lib/collaboration/types'
import { assignCursorColor } from '@/lib/collaboration/colors'

interface PresenceOverlayProps {
  session: CollaborationSession | null
  visible: boolean
  localUserId?: string
}

export default function PresenceOverlay({
  session,
  visible,
  localUserId,
}: PresenceOverlayProps) {
  if (!visible || !session) return null

  const collaboratorMap = new Map(
    session.collaborators.map((c) => [c.userId, c]),
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {session.cursors.map((cursor) => {
        const collaborator = collaboratorMap.get(cursor.userId)
        const name =
          collaborator?.name ||
          (cursor.userId === localUserId ? 'You' : 'Guest')
        const color =
          collaborator?.color ||
          assignCursorColor(
            cursor.userId,
            cursor.userId === localUserId ? 'local' : '',
          )

        return (
          <div
            key={`${cursor.userId}-${cursor.updatedAt}`}
            className="absolute -translate-y-5 translate-x-2"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <div
              className="pointer-events-none flex items-center gap-2 rounded-lg border bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-slate-50 shadow-lg backdrop-blur"
              style={{
                borderColor: color,
                boxShadow: `0 0 0 1px ${color}55`,
              }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: color }}
              />
              {name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import type { PresenceUser } from '@/lib/collab/types'
import { getPresenceColor } from '@/lib/collab/colors'

interface PresenceCursorsOverlayProps {
  presence: PresenceUser[]
  visible?: boolean
}

export default function PresenceCursorsOverlay({
  presence,
  visible = true,
}: PresenceCursorsOverlayProps) {
  if (!visible || !presence.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {presence
        .filter((p) => p.cursor)
        .map((p) => {
          const color = getPresenceColor(p.userId)
          return (
            <div
              key={p.id}
              className="absolute -translate-y-5 translate-x-2"
              style={{ left: p.cursor!.x, top: p.cursor!.y }}
            >
              <div
                className="pointer-events-none flex items-center gap-2 rounded-lg border bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-slate-50 shadow-lg backdrop-blur"
                style={{
                  borderColor: color.ring,
                  boxShadow: `0 0 0 1px ${color.ring}55`,
                }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: color.base }}
                />
                {p.displayName || 'Guest'}
              </div>
            </div>
          )
        })}
    </div>
  )
}

'use client'

import type { LockDescriptor, PresenceUser } from '@/lib/collab/types'

interface LocksOverlayProps {
  locks: LockDescriptor[]
  presence: PresenceUser[]
  visible?: boolean
}

export default function LocksOverlay({
  locks,
  presence,
  visible = true,
}: LocksOverlayProps) {
  if (!visible || !locks.length) return null

  const presenceMap = new Map(presence.map((p) => [p.userId, p]))

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {locks.map((lock) => {
        const p = presenceMap.get(lock.ownerUserId)
        const label = p?.displayName || 'Locked'
        return (
          <div
            key={lock.id}
            className="absolute -translate-y-3 translate-x-3"
            style={{
              left: p?.cursor?.x ?? 0,
              top: p?.cursor?.y ?? 0,
            }}
          >
            <div className="pointer-events-auto rounded-full border border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100 shadow-md">
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

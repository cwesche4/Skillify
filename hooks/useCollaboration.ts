'use client'

import { useEffect, useMemo, useState } from 'react'

type PresenceUser = {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
  selectedNodeIds?: string[]
}

// Ephemeral, visual-only collaboration state. No mutations to builder state.
export function useCollaboration(enabled: boolean) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!enabled) return
    // Placeholder subscription hook; replace with real presence feed.
    setUsers([])
  }, [enabled])

  const cursors = useMemo(
    () => users.flatMap((u) => (u.cursor ? [{ ...u }] : [])),
    [users],
  )

  const lockedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    users.forEach((u) => {
      ;(u.selectedNodeIds || []).forEach((id) => ids.add(id))
    })
    return ids
  }, [users])

  return {
    users,
    cursors,
    lockedNodeIds,
  }
}

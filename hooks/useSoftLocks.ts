'use client'

import { useMemo } from 'react'
import type { CollaborationSession, NodeLock } from '@/lib/collaboration/types'

type SoftLockHelpers = {
  locks: NodeLock[]
  isNodeSoftLocked: (nodeId: string) => boolean
  getLockOwner: (nodeId: string) => string | undefined
}

// Read-only derivation of soft locks from collaboration session; no side effects.
export function useSoftLocks(
  session: CollaborationSession | null,
): SoftLockHelpers {
  const locks = useMemo(
    () => (session?.locks || []).filter((l) => l.mode === 'soft'),
    [session?.locks],
  )

  const lockMap = useMemo(() => {
    const map = new Map<string, NodeLock[]>()
    locks.forEach((lock) => {
      if (!lock.nodeId) return
      const list = map.get(lock.nodeId) ?? []
      list.push(lock)
      map.set(lock.nodeId, list)
    })
    return map
  }, [locks])

  return {
    locks,
    isNodeSoftLocked: (nodeId: string) =>
      (lockMap.get(nodeId)?.length ?? 0) > 0,
    getLockOwner: (nodeId: string) => lockMap.get(nodeId)?.[0]?.lockedBy,
  }
}

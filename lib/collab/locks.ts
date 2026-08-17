import type { LockDescriptor, LockState } from './types'

export function computeLockState(
  intent: 'hover' | 'select' | 'edit' | 'drag',
  current: LockState | null,
): LockState {
  if (intent === 'drag' || intent === 'edit') return 'HARD'
  if (intent === 'select') return current === 'HARD' ? 'HARD' : 'SOFT'
  return current ?? 'SOFT'
}

export function isLockExpired(
  lock: Pick<LockDescriptor, 'expiresAt'>,
  now: number,
) {
  if (!lock.expiresAt) return false
  return lock.expiresAt < now
}

export function canUserEditNode({
  locks,
  nodeId,
  userId,
}: {
  locks: LockDescriptor[]
  nodeId: string
  userId: string
}): { allowed: boolean; reason?: string; blockingLock?: LockDescriptor } {
  const lock = locks.find(
    (l) =>
      l.nodeId === nodeId && l.ownerUserId !== userId && l.state === 'HARD',
  )
  if (!lock) return { allowed: true }
  return {
    allowed: false,
    reason: 'Locked by another user',
    blockingLock: lock,
  }
}

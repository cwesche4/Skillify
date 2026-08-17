const WINDOW_MS = 60_000
const LIMIT = 10

type Key = string

// In-memory sliding-ish window per workspace+user. Acceptable for now.
const buckets: Map<Key, { windowStart: number; count: number }> = new Map()

export function checkAiActionRate(params: {
  workspaceId: string
  userId: string
}): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const key = `${params.workspaceId}:${params.userId}`
  const now = Date.now()

  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 })
    return { allowed: true }
  }

  if (bucket.count >= LIMIT) {
    const retryAfterMs = WINDOW_MS - (now - bucket.windowStart)
    return { allowed: false, retryAfterMs }
  }

  bucket.count += 1
  return { allowed: true }
}

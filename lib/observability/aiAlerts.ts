type AlertType = 'denial_spike' | 'rate_limit_spike' | 'undo_conflict_spike'

type Alert = {
  type: AlertType
  workspaceId: string
  count: number
  windowMs: number
}

const WINDOW_MS = 5 * 60 * 1000
const THRESHOLD = {
  denial_spike: 5,
  rate_limit_spike: 5,
  undo_conflict_spike: 3,
}

const buckets: Map<string, { count: number; windowStart: number }> = new Map()

function key(type: AlertType, workspaceId: string) {
  return `${type}:${workspaceId}`
}

function logAlert(alert: Alert) {
  // eslint-disable-next-line no-console
  console.warn('[ai-alert]', JSON.stringify(alert))
}

export function emitAiAlert(type: AlertType, workspaceId: string) {
  const k = key(type, workspaceId)
  const now = Date.now()
  const bucket = buckets.get(k)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(k, { count: 1, windowStart: now })
    return
  }

  bucket.count += 1
  if (bucket.count >= THRESHOLD[type]) {
    logAlert({
      type,
      workspaceId,
      count: bucket.count,
      windowMs: WINDOW_MS,
    })
    // reset after alert to avoid spamming
    buckets.set(k, { count: 0, windowStart: now })
  }
}

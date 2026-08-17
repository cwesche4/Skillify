// Canonical Inspector telemetry events
// Format: inspector_<domain>_<action>
// NOTE: Do not rename without migrating downstream analytics
type InspectorTelemetryEvent =
  | 'inspector_opened'
  | 'inspector_closed'
  | 'inspector_tab_changed'
  | 'inspector_tab_viewed'
  | 'inspector_pin_toggle'
  | 'inspector_follow_toggle'
  | 'inspector_dock_change'
  | 'inspector_width_preset'
  | 'inspector_resize_drag_end'
  | 'inspector_ai_score_computed'
  | 'inspector_ai_suggestion_shown'
  | 'inspector_ai_suggestion_viewed'
  | 'inspector_ai_suggestion_dismissed'
  | 'inspector_ai_action_applied'
  | 'inspector_ai_action_failed'
  | 'inspector_ai_autofix_applied'
  | 'inspector_ai_autofix_failed'
  | 'inspector_walkthrough_step_viewed'
  | 'inspector_walkthrough_dismissed'
  | 'inspector_replay_deeplink_clicked'
  | 'inspector_work_mode_changed'
  | 'inspector_preset_saved'
  | 'inspector_preset_applied'
  | 'inspector_preset_deleted'
  | 'inspector_validation_failed'
  | 'inspector_validation_cleared'

export type InspectorTelemetryPayload = {
  workspaceId?: string
  automationId?: string
  nodeType?: string
  tab?: string
  dockSide?: string
  widthPreset?: string
  mode?: string
  fieldsChanged?: string[]
  timestamp?: number
}

const buffer: Array<{
  event: InspectorTelemetryEvent
  payload: InspectorTelemetryPayload
}> = []

const pending: Array<{
  event: InspectorTelemetryEvent
  payload: InspectorTelemetryPayload
}> = []

const FLUSH_THRESHOLD = 20
const FLUSH_DELAY_MS = 5000

let flushTimer: ReturnType<typeof setTimeout> | null = null

async function sendPendingBatch() {
  if (typeof window === 'undefined') return
  if (!pending.length) return

  const batch = pending.splice(0, pending.length)

  try {
    await fetch('/api/telemetry/inspector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    })
  } catch (err) {
    // swallow and re-queue for a later attempt
    pending.unshift(...batch)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[InspectorTelemetry] flush failed, will retry', err)
    }
  } finally {
    flushTimer = null
  }
}

function scheduleFlush() {
  if (pending.length >= FLUSH_THRESHOLD) {
    void sendPendingBatch()
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    void sendPendingBatch()
  }, FLUSH_DELAY_MS)
}

export function logInspectorEvent(
  event: InspectorTelemetryEvent,
  payload: InspectorTelemetryPayload,
  enabled = false,
) {
  if (!enabled) return
  const entry = {
    event,
    payload: { ...payload, timestamp: Date.now() },
  }
  buffer.push(entry)
  pending.push(entry)
  scheduleFlush()
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[InspectorTelemetry]', entry)
  }
}

export function getInspectorTelemetryBuffer() {
  return buffer
}

const trackOnceCache = new Set<string>()

export function trackOnce(key: string, fn: () => void, enabled = false) {
  if (!enabled) return
  if (trackOnceCache.has(key)) return
  trackOnceCache.add(key)
  fn()
}

export function flushInspectorTelemetry() {
  const copy = [...buffer]
  buffer.length = 0
  return copy
}

export async function flushInspectorTelemetryToServer() {
  await sendPendingBatch()
}

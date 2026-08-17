// =================================================================================================
// CONTRACT: OWNED BY PHASE 1 (Foundations & Data Contracts) AND PHASE 3 (Analytics Read Models)
// CONSUMED BY PHASE 5 (Heatmaps), PHASE 6 (Analytics UI), PHASE 7 (Onboarding), PHASE 8 (AI Coach)
// THIS FILE MUST NOT BE EXTENDED BY ANY PHASE BEYOND PHASE 3.
// =================================================================================================

// Pure, deterministic Inspector telemetry aggregation helpers.
// These functions are read-only, side-effect free, and do not mutate inputs.
// They are intended for future analytics/heatmap layers.

import type { InspectorTelemetryPayload } from '@/lib/inspector/telemetry'

type InspectorTelemetryEntry = {
  event: string
  payload: InspectorTelemetryPayload
}

export type InspectorHeatmapPoint = {
  workspaceId: string
  nodeType: string
  tab: string
  event: string
  bucket: string
  count: number
}

type TimeBucket = 'hour' | 'day'

// ─────────────────────────────────────────────
// PHASE 1 — CORE AGGREGATION PRIMITIVES
// ─────────────────────────────────────────────

function bucketTimestamp(ts: number | undefined, bucket: TimeBucket): string {
  if (!ts || Number.isNaN(ts)) return 'unknown'
  const date = new Date(ts)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  if (bucket === 'hour') {
    const h = pad(date.getUTCHours())
    return `${y}-${m}-${d}T${h}:00Z`
  }
  return `${y}-${m}-${d}`
}

function keyParts(
  payload: InspectorTelemetryPayload,
  bucket: TimeBucket,
  tab?: string,
  event?: string,
) {
  return [
    payload.workspaceId ?? 'unknown',
    payload.nodeType ?? 'unknown',
    tab ?? payload.tab ?? 'unknown',
    event ?? 'unknown',
    bucketTimestamp(payload.timestamp, bucket),
  ]
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function splitKey(key: string): {
  workspaceId: string
  nodeType: string
  tab: string
  event: string
  bucket: string
} {
  const parts = key.split('|')
  const [workspaceId, nodeType, tab, event, bucket] = [
    parts[0] ?? 'unknown',
    parts[1] ?? 'unknown',
    parts[2] ?? 'unknown',
    parts[3] ?? 'unknown',
    parts[4] ?? 'unknown',
  ]
  return { workspaceId, nodeType, tab, event, bucket }
}

function normalizeCounts(map: Map<string, number>): InspectorHeatmapPoint[] {
  const result: InspectorHeatmapPoint[] = []
  map.forEach((count, key) => {
    const parsed = splitKey(key)
    result.push({ ...parsed, count })
  })
  return result
}

/**
 * PHASE: 1
 * Contract:
 * - Pure aggregation helper
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorTabUsage(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const counts = new Map<string, number>()
  for (const e of events || []) {
    if (e?.event !== 'inspector_tab_viewed') continue
    const key = keyParts(e.payload || {}, bucket).join('|')
    increment(counts, key)
  }
  return counts
}

/**
 * PHASE: 1
 * Contract:
 * - Pure aggregation helper
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorValidationFrequency(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const counts = new Map<string, number>()
  for (const e of events || []) {
    if (
      e?.event !== 'inspector_validation_failed' &&
      e?.event !== 'inspector_validation_cleared'
    )
      continue
    const key = keyParts(e.payload || {}, bucket, undefined, e.event).join('|')
    increment(counts, key)
  }
  return counts
}

/**
 * PHASE: 1
 * Contract:
 * - Pure aggregation helper
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorAISuggestionRates(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const counts = new Map<
    string,
    { shown: number; applied: number; failed: number }
  >()
  for (const e of events || []) {
    if (
      e?.event !== 'inspector_ai_suggestion_shown' &&
      e?.event !== 'inspector_ai_autofix_applied' &&
      e?.event !== 'inspector_ai_action_failed'
    )
      continue
    const key = keyParts(e.payload || {}, bucket).join('|')
    const current = counts.get(key) ?? { shown: 0, applied: 0, failed: 0 }
    if (e.event === 'inspector_ai_suggestion_shown') current.shown += 1
    if (e.event === 'inspector_ai_autofix_applied') current.applied += 1
    if (e.event === 'inspector_ai_action_failed') current.failed += 1
    counts.set(key, current)
  }
  return counts
}

// ─────────────────────────────────────────────
// PHASE 3 — READ MODEL DERIVATIONS
// ─────────────────────────────────────────────

/**
 * PHASE: 3
 * Contract:
 * - Pure read-model derivation
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorAIEventCounts(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const rates = getInspectorAISuggestionRates(events, bucket)
  const result: {
    key: string
    workspaceId: string
    nodeType: string
    tab: string
    bucket: string
    shown: number
    applied: number
    failed: number
  }[] = []
  rates.forEach((value, key) => {
    const parsed = splitKey(key)
    result.push({
      key,
      workspaceId: parsed.workspaceId,
      nodeType: parsed.nodeType,
      tab: parsed.tab,
      bucket: parsed.bucket,
      shown: value.shown ?? 0,
      applied: value.applied ?? 0,
      failed: value.failed ?? 0,
    })
  })
  return result
}

/**
 * PHASE: 1
 * Contract:
 * - Pure aggregation helper
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorPresetUsage(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const counts = new Map<
    string,
    { saved: number; applied: number; deleted: number }
  >()
  for (const e of events || []) {
    if (
      e?.event !== 'inspector_preset_saved' &&
      e?.event !== 'inspector_preset_applied' &&
      e?.event !== 'inspector_preset_deleted'
    )
      continue
    const key = keyParts(e.payload || {}, bucket, undefined, e.event).join('|')
    const current = counts.get(key) ?? { saved: 0, applied: 0, deleted: 0 }
    if (e.event === 'inspector_preset_saved') current.saved += 1
    if (e.event === 'inspector_preset_applied') current.applied += 1
    if (e.event === 'inspector_preset_deleted') current.deleted += 1
    counts.set(key, current)
  }
  return counts
}

/**
 * PHASE: 3
 * Contract:
 * - Pure read-model derivation
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorTabHeatmap(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  return normalizeCounts(getInspectorTabUsage(events, bucket))
}

/**
 * PHASE: 3
 * Contract:
 * - Pure read-model derivation
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorValidationHeatmap(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  return normalizeCounts(getInspectorValidationFrequency(events, bucket))
}

/**
 * PHASE: 3
 * Contract:
 * - Pure read-model derivation
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorAIHeatmap(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const counts = new Map<string, number>()
  const aiRates = getInspectorAISuggestionRates(events, bucket)
  aiRates.forEach((value, key) => {
    const total =
      (value.shown ?? 0) + (value.applied ?? 0) + (value.failed ?? 0)
    counts.set(key, total)
  })
  return normalizeCounts(counts)
}

/**
 * PHASE: 3
 * Contract:
 * - Pure read-model derivation
 * - Deterministic output for identical input
 * - Read-only; no mutation
 * - MUST NOT be extended or modified by later phases
 */
export function getInspectorPresetHeatmap(
  events: InspectorTelemetryEntry[],
  bucket: TimeBucket = 'day',
) {
  const counts = new Map<string, number>()
  const presetRates = getInspectorPresetUsage(events, bucket)
  presetRates.forEach((value, key) => {
    const total =
      (value.saved ?? 0) + (value.applied ?? 0) + (value.deleted ?? 0)
    counts.set(key, total)
  })
  return normalizeCounts(counts)
}

// ─────────────────────────────────────────────
// CONSUMER GUARANTEES (READ-ONLY)
// ─────────────────────────────────────────────
// - Consumers must treat all outputs as immutable data.
// - No function in this file may be modified by phases beyond Phase 3.
// - All inputs are assumed to be pre-filtered telemetry payloads.

// =================================================================================================
// FINAL GUARANTEE:
// - No function in this file may read raw telemetry directly, emit telemetry, mutate inputs, depend
//   on UI state, or depend on feature flags.
// - Any future need requires a NEW FILE, a NEW PHASE, and a CONTRACT UPDATE.
// =================================================================================================

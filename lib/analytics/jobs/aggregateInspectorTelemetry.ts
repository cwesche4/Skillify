// Pure, deterministic aggregation jobs for Inspector telemetry.
// These helpers are read-only and mutate nothing; intended as materialized read models.

import {
  getInspectorAIHeatmap,
  getInspectorPresetHeatmap,
  getInspectorTabHeatmap,
  getInspectorValidationHeatmap,
  type InspectorHeatmapPoint,
} from '@/lib/analytics/inspectorAggregates'
import type { InspectorTelemetryPayload } from '@/lib/inspector/telemetry'

export type InspectorTelemetryRecord = {
  event: string
  payload: InspectorTelemetryPayload & { timestamp?: number }
}

export type InspectorAggregationResult = {
  tabUsage: InspectorHeatmapPoint[]
  validation: InspectorHeatmapPoint[]
  ai: InspectorHeatmapPoint[]
  presets: InspectorHeatmapPoint[]
}

export function aggregateInspectorTelemetry(
  records: InspectorTelemetryRecord[] = [],
): InspectorAggregationResult {
  const safeRecords = Array.isArray(records)
    ? records.filter((r) => r && r.event && r.payload)
    : []

  const tabUsage = getInspectorTabHeatmap(safeRecords)
  const validation = getInspectorValidationHeatmap(safeRecords)
  const ai = getInspectorAIHeatmap(safeRecords)
  const presets = getInspectorPresetHeatmap(safeRecords)

  return { tabUsage, validation, ai, presets }
}

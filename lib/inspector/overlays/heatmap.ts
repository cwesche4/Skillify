import type { InspectorHeatmapPoint } from '@/lib/analytics/inspectorAggregates'
import type { InspectorOverlay } from '@/lib/inspector/overlays/types'

type NormalizedHeatmapPoint = InspectorHeatmapPoint & { intensity: number }

export type HeatmapOverlayData = {
  points: NormalizedHeatmapPoint[]
}

/**
 * Builds a heatmap overlay definition from pre-aggregated telemetry points.
 * Overlays are inert by default (enabled=false, opacity=0).
 */
export function buildHeatmapOverlay(
  points: InspectorHeatmapPoint[],
  enabled = false,
): InspectorOverlay {
  const safePoints = Array.isArray(points) ? points.filter(Boolean) : []
  const max = safePoints.reduce((acc, p) => Math.max(acc, p?.count ?? 0), 0)
  const normalized: NormalizedHeatmapPoint[] = safePoints.map((p) => ({
    ...p,
    intensity: max > 0 ? (p.count ?? 0) / max : 0,
  }))

  return {
    id: 'inspector-heatmap',
    type: 'heatmap',
    data: { points: normalized } satisfies HeatmapOverlayData,
    opacity: 0,
    enabled,
    zIndex: 0,
  }
}

'use client'

interface HeatmapLegendProps {
  enabled: boolean
  avoidMinimap?: boolean
}

export default function HeatmapLegend({
  enabled,
  avoidMinimap = false,
}: HeatmapLegendProps) {
  if (!enabled) return null

  return (
    <div
      className={[
        'absolute right-4 z-30 rounded-lg border border-slate-800/80 bg-slate-950/90 px-3 py-2 text-[10px] text-slate-300 shadow-soft',
        avoidMinimap ? 'bottom-44' : 'bottom-4',
      ].join(' ')}
    >
      <div className="mb-1 font-semibold">Failure Heatmap</div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-4 rounded bg-emerald-500" />
        <span className="text-[10px]">No failures</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-4 rounded bg-amber-400" />
        <span className="text-[10px]">Some failures</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-4 rounded bg-rose-500" />
        <span className="text-[10px]">Frequent failures</span>
      </div>
    </div>
  )
}

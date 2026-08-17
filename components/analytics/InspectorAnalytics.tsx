import type { InspectorHeatmapPoint } from '@/lib/analytics/inspectorAggregates'

type SectionProps = {
  title: string
  points: InspectorHeatmapPoint[]
  emptyText: string
}

function HeatmapTable({ title, points, emptyText }: SectionProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="text-[11px] text-slate-400">{points.length} rows</span>
      </div>
      {points.length === 0 ? (
        <p className="mt-3 text-[12px] text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[12px] text-slate-200">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1">Node</th>
                <th className="px-2 py-1">Tab</th>
                <th className="px-2 py-1">Event</th>
                <th className="px-2 py-1">Bucket</th>
                <th className="px-2 py-1 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, idx) => (
                <tr
                  key={`${p.workspaceId}-${p.nodeType}-${p.tab}-${p.event}-${p.bucket}-${idx}`}
                >
                  <td className="px-2 py-1 font-medium text-slate-100">
                    {p.nodeType}
                  </td>
                  <td className="px-2 py-1 text-slate-300">{p.tab}</td>
                  <td className="px-2 py-1 text-slate-300">{p.event}</td>
                  <td className="px-2 py-1 text-slate-300">{p.bucket}</td>
                  <td className="px-2 py-1 text-right text-slate-100">
                    {p.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type TimeSeriesProps = {
  title: string
  points: InspectorHeatmapPoint[]
  emptyText: string
}

function TimeSeriesTable({ title, points, emptyText }: TimeSeriesProps) {
  const buckets = points.reduce<Record<string, number>>((acc, p) => {
    const key = p.bucket || 'unknown'
    acc[key] = (acc[key] ?? 0) + (p.count || 0)
    return acc
  }, {})
  const rows = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="text-[11px] text-slate-400">
          {rows.length} buckets
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[12px] text-slate-200">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1">Bucket</th>
                <th className="px-2 py-1 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([bucket, count]) => (
                <tr key={bucket}>
                  <td className="px-2 py-1 text-slate-300">{bucket}</td>
                  <td className="px-2 py-1 text-right text-slate-100">
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type ComparisonProps = {
  title: string
  points: InspectorHeatmapPoint[]
  emptyText: string
}

function ComparisonTable({ title, points, emptyText }: ComparisonProps) {
  const grouped = points.reduce<Record<string, number>>((acc, p) => {
    const key = `${p.nodeType || 'unknown'}${p.tab ? `:${p.tab}` : ''}`
    acc[key] = (acc[key] ?? 0) + (p.count || 0)
    return acc
  }, {})

  const rows = Object.entries(grouped).sort((a, b) => b[1] - a[1])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="text-[11px] text-slate-400">
          {rows.length} comparisons
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[12px] text-slate-200">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1">Node / Tab</th>
                <th className="px-2 py-1 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, count]) => (
                <tr key={key}>
                  <td className="px-2 py-1 text-slate-300">{key}</td>
                  <td className="px-2 py-1 text-right text-slate-100">
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type InspectorAnalyticsProps = {
  tabUsage: InspectorHeatmapPoint[]
  validation: InspectorHeatmapPoint[]
  ai: InspectorHeatmapPoint[]
  presets: InspectorHeatmapPoint[]
}

export function InspectorAnalyticsView({
  tabUsage,
  validation,
  ai,
  presets,
}: InspectorAnalyticsProps) {
  const allPoints = [...tabUsage, ...validation, ...ai, ...presets]

  return (
    <div className="space-y-6">
      <HeatmapTable
        title="Tab engagement"
        points={tabUsage}
        emptyText="No tab usage telemetry available."
      />
      <HeatmapTable
        title="Validation signals"
        points={validation}
        emptyText="No validation telemetry available."
      />
      <HeatmapTable
        title="AI interactions"
        points={ai}
        emptyText="No AI telemetry available."
      />
      <HeatmapTable
        title="Preset usage"
        points={presets}
        emptyText="No preset telemetry available."
      />
      <TimeSeriesTable
        title="Time-series overview"
        points={allPoints}
        emptyText="No telemetry buckets available."
      />
      <ComparisonTable
        title="Node / tab comparisons"
        points={tabUsage}
        emptyText="No comparison data available."
      />
    </div>
  )
}

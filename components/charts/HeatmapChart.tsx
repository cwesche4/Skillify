"use client"

import { useMemo } from "react"

export interface HeatmapDatum {
  x: string // e.g. day or hour label on X axis
  y: string // e.g. metric / row label on Y axis
  value: number
}

export interface HeatmapChartProps {
  data: HeatmapDatum[]
  xLabels: string[]
  yLabels: string[]
  min?: number
  max?: number
  className?: string
  valueSuffix?: string
}

/**
 * Simple CSS-grid heatmap.
 * You pass in xLabels & yLabels to define the grid,
 * and data as (x,y,value) tuples.
 */
export function HeatmapChart({
  data,
  xLabels,
  yLabels,
  min,
  max,
  className,
  valueSuffix = "%",
}: HeatmapChartProps) {
  const valueMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of data) {
      map.set(`${d.x}::${d.y}`, d.value)
    }
    return map
  }, [data])

  const [computedMin, computedMax] = useMemo(() => {
    if (min != null && max != null) return [min, max]

    if (!data.length) return [0, 1]

    let localMin = data[0]?.value ?? 0
    let localMax = data[0]?.value ?? 1

    for (const d of data) {
      if (d.value < localMin) localMin = d.value
      if (d.value > localMax) localMax = d.value
    }
    if (localMin === localMax) {
      // Avoid divide-by-zero
      localMin = 0
      localMax = localMax || 1
    }
    return [localMin, localMax]
  }, [data, min, max])

  const getIntensity = (value: number | undefined): number => {
    if (value == null) return 0
    if (computedMax === computedMin) return 0.5
    return (value - computedMin) / (computedMax - computedMin)
  }

  return (
    <div
      className={`text-neutral-text-secondary w-full overflow-x-auto text-[11px] ${
        className ?? ""
      }`}
    >
      <div className="inline-grid min-w-full">
        {/* Header row with X labels */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `auto repeat(${xLabels.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="px-2 py-1" />
          {xLabels.map((x) => (
            <div
              key={x}
              className="text-neutral-text-secondary px-2 py-1 text-center text-[10px]"
            >
              {x}
            </div>
          ))}
        </div>

        {/* Rows */}
        {yLabels.map((y) => (
          <div
            key={y}
            className="grid"
            style={{
              gridTemplateColumns: `auto repeat(${xLabels.length}, minmax(0, 1fr))`,
            }}
          >
            {/* Y label */}
            <div className="text-neutral-text-secondary px-2 py-1 pr-3 text-right text-[10px]">
              {y}
            </div>

            {/* Cells */}
            {xLabels.map((x) => {
              const key = `${x}::${y}`
              const value = valueMap.get(key)
              const intensity = getIntensity(value)

              const bg = `rgba(37, 99, 235, ${0.1 + intensity * 0.7})` // blue-600-ish

              return (
                <div
                  key={key}
                  className="border-neutral-border/40 relative flex h-7 items-center justify-center rounded-sm border"
                  style={{ backgroundColor: value != null ? bg : "transparent" }}
                  title={value != null ? `${value.toFixed(1)}${valueSuffix}` : "No data"}
                >
                  {value != null && (
                    <span className="text-neutral-card-light text-[10px]">
                      {value.toFixed(0)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

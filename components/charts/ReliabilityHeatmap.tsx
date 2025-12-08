'use client'

import type { FC } from 'react'
import {
  ComposedChart,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Rectangle } from 'recharts'
import { ChartGradients } from './ChartGradients'

export type ReliabilityPoint = {
  dayLabel: string // "Mon"
  hourLabel: string // "09:00"
  successRate: number // 0–100
}

type ReliabilityHeatmapProps = {
  data: ReliabilityPoint[]
  idPrefix?: string
}

const successToColor = (value: number): string => {
  if (value >= 98) return '#22c55e'
  if (value >= 90) return '#4ade80'
  if (value >= 80) return '#facc15'
  if (value > 0) return '#f97316'
  return '#ef4444'
}

export const ReliabilityHeatmap: FC<ReliabilityHeatmapProps> = ({
  data,
  idPrefix = 'reliability',
}) => {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <ChartGradients idPrefix={idPrefix} />

          <XAxis
            dataKey="hourLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
          />

          <YAxis
            dataKey="dayLabel"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            width={38}
          />

          <Tooltip
            formatter={(value: unknown) => [
              `${(value as number).toFixed(1)}%`,
              'Success rate',
            ]}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              backgroundColor: '#020617',
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.4)',
              fontSize: 11,
            }}
            labelStyle={{ color: '#e5e7eb' }}
          />

          {/* DRAW GRID USING CUSTOMIZED */}
          <Customized
            component={(props) => {
              const {
                xAxisMap,
                yAxisMap,
                offset,
                chartHeight,
                chartWidth,
                data,
              } = props as any

              const xAxis = xAxisMap[0]
              const yAxis = yAxisMap[0]

              return (
                <>
                  {data.map((point: ReliabilityPoint, index: number) => {
                    const x = xAxis.scale(point.hourLabel)
                    const y = yAxis.scale(point.dayLabel)

                    const cellWidth =
                      (chartWidth - offset.left - offset.right) /
                      xAxis.ticks.length

                    const cellHeight =
                      (chartHeight - offset.top - offset.bottom) /
                      yAxis.ticks.length

                    return (
                      <Rectangle
                        key={`cell-${index}`}
                        x={x}
                        y={y}
                        width={cellWidth}
                        height={cellHeight}
                        fill={successToColor(point.successRate)}
                        stroke="#0f172a"
                        strokeWidth={0.5}
                        radius={3}
                      />
                    )
                  })}
                </>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

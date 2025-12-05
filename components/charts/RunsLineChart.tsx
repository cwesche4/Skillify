// components/charts/RunsLineChart.tsx
"use client"

import type { FC } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartGradients } from "./ChartGradients"

export type RunsLinePoint = {
  dateLabel: string // e.g. "Mon", "Nov 28"
  total: number
  success: number
  failed: number
}

type RunsLineChartProps = {
  data: RunsLinePoint[]
  /**
   * Optional gradient id prefix so multiple charts
   * do not clash in the same DOM tree.
   */
  idPrefix?: string
}

export const RunsLineChart: FC<RunsLineChartProps> = ({
  data,
  idPrefix = "runs-line",
}) => {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <RechartsLineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <ChartGradients idPrefix={idPrefix} />
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-slate-800/70"
            vertical={false}
          />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            width={32}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#020617",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.4)",
              fontSize: 11,
            }}
            labelStyle={{ color: "#e5e7eb" }}
          />
          <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total runs"
            stroke="url(#runs-line-subtle)"
            strokeWidth={1.6}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="success"
            name="Success"
            stroke="url(#runs-line-success)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke="url(#runs-line-danger)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

"use client"

import {
  Bar,
  CartesianGrid,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface SimpleBarDatum {
  label: string
  value: number
}

export interface BarChartProps {
  data: SimpleBarDatum[]
  height?: number
  valueLabel?: string
}

export function BarChart({ data, height = 220, valueLabel = "Value" }: BarChartProps) {
  return (
    <div className="h-full min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: "rgba(148,163,184,0.9)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={32}
            tick={{ fontSize: 11, fill: "rgba(148,163,184,0.9)" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.7)" }}
            contentStyle={{
              backgroundColor: "rgb(15 23 42)",
              border: "1px solid rgba(148,163,184,0.4)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.75rem",
            }}
            labelStyle={{ fontSize: "0.75rem", color: "rgb(148,163,184)" }}
            formatter={(value: unknown) => [`${value as number}`, valueLabel]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--brand-primary)" />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

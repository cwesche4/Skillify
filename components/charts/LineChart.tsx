'use client'

import {
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface SimpleLineDatum {
  label: string // x-axis
  value: number // y-axis
}

export interface LineChartProps {
  data: SimpleLineDatum[]
  label?: string // OPTIONAL chart label (now added)
}

export function LineChart({ data, label }: LineChartProps) {
  return (
    <div className="h-64 w-full">
      {label && (
        <p className="text-neutral-text-secondary mb-2 text-xs">{label}</p>
      )}

      <ResponsiveContainer>
        <ReLineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            domain={[0, 'auto']}
            tickFormatter={(v) => `${v}`}
          />

          <Tooltip
            contentStyle={{
              background: '#020617',
              border: '1px solid #1e293b',
              fontSize: 12,
            }}
            labelStyle={{ color: '#e2e8f0' }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  )
}

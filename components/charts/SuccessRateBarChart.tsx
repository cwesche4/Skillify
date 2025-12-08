// components/charts/SuccessRateBarChart.tsx
'use client'

import type { FC } from 'react'
import {
  Bar,
  CartesianGrid,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartGradients } from './ChartGradients'

export type SuccessRatePoint = {
  label: string // "Mon", "Week 48", "Automation A"
  successRate: number // 0–100
  totalRuns?: number
}

type SuccessRateBarChartProps = {
  data: SuccessRatePoint[]
  idPrefix?: string
}

export const SuccessRateBarChart: FC<SuccessRateBarChartProps> = ({
  data,
  idPrefix = 'success-rate',
}) => {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <RechartsBarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <ChartGradients idPrefix={idPrefix} />
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-slate-800/70"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={32}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(value: unknown, _name, payload) => {
              const v = value as number
              const total = payload?.payload?.totalRuns as number | undefined
              return total != null
                ? [`${v.toFixed(1)}% of ${total} runs`, 'Success rate']
                : [`${v.toFixed(1)}%`, 'Success rate']
            }}
            labelStyle={{ color: '#e5e7eb' }}
            contentStyle={{
              backgroundColor: '#020617',
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.4)',
              fontSize: 11,
            }}
          />
          <Bar
            dataKey="successRate"
            radius={[6, 6, 0, 0]}
            fill={`url(#${idPrefix}-success)`}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

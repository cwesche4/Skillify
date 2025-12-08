'use client'

import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
} from 'recharts'

export interface SparklineDatum {
  label: string
  value: number
}

export interface SparklineProps {
  data: SparklineDatum[]
  height?: number
  strokeColor?: string
}

export function Sparkline({
  data,
  height = 56,
  strokeColor = 'var(--brand-primary)',
}: SparklineProps) {
  return (
    <div className="h-full min-h-[40px] w-full">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export type InsightSeriesPoint = {
  label: string
  value: number
  secondary?: number
}

export type InsightBreakdownPoint = {
  label: string
  value: number
  color?: string
  helper?: string
}

const defaultColors = [
  '#22d3ee',
  '#8b5cf6',
  '#60a5fa',
  '#34d399',
  '#f59e0b',
  '#fb7185',
]
const chartGridStroke = 'var(--chart-grid)'
const chartAxisTick = { fill: 'var(--chart-text-muted)', fontSize: 11 }

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  notation: 'compact',
})

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatInsightCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatInsightNumber(value: number) {
  return compactFormatter.format(value)
}

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = '',
  valueSuffix = '',
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
  valuePrefix?: string
  valueSuffix?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="border-app-strong rounded-xl border bg-[var(--chart-tooltip-surface)] px-3 py-2 text-xs text-[var(--chart-tooltip-text)] shadow-[var(--shadow-card)] backdrop-blur">
      <p className="mb-1 font-medium text-[var(--chart-tooltip-text)]">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={`${item.name}-${item.value}`}
            className="text-chart-muted flex items-center gap-2"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color ?? '#22d3ee' }}
            />
            <span>{item.name ?? 'Value'}:</span>
            <span className="text-chart font-medium">
              {valuePrefix}
              {formatInsightNumber(Number(item.value ?? 0))}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        'border-app bg-chart-surface overflow-hidden shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1">{description}</CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function EmptyChartState({
  label = 'No chart data yet.',
}: {
  label?: string
}) {
  return (
    <div className="border-app bg-chart-surface text-neutral-text-secondary flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm">
      {label}
    </div>
  )
}

export function InsightAreaChart({
  data,
  height = 220,
  valuePrefix,
  valueSuffix,
  secondaryLabel = 'Secondary',
}: {
  data: InsightSeriesPoint[]
  height?: number
  valuePrefix?: string
  valueSuffix?: string
  secondaryLabel?: string
}) {
  if (!data.length) return <EmptyChartState />

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="skillifyAreaPrimary"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.34} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient
              id="skillifyAreaSecondary"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartGridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={chartAxisTick}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={chartAxisTick}
            tickFormatter={(value) => formatInsightNumber(Number(value))}
            width={38}
          />
          <Tooltip
            content={
              <ChartTooltip
                valuePrefix={valuePrefix}
                valueSuffix={valueSuffix}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Value"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#skillifyAreaPrimary)"
          />
          {data.some((point) => typeof point.secondary === 'number') ? (
            <Area
              type="monotone"
              dataKey="secondary"
              name={secondaryLabel}
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#skillifyAreaSecondary)"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniSparkline({
  data,
  className,
}: {
  data: InsightSeriesPoint[]
  className?: string
}) {
  if (!data.length) return null

  return (
    <div className={cn('h-14 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 0, top: 6, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="skillifyMiniSparkline"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.34} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="#67e8f9"
            strokeWidth={2}
            fill="url(#skillifyMiniSparkline)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function InsightBarChart({
  data,
  height = 220,
  valuePrefix,
  valueSuffix,
}: {
  data: InsightBreakdownPoint[]
  height?: number
  valuePrefix?: string
  valueSuffix?: string
}) {
  if (!data.length) return <EmptyChartState />

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={chartGridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={chartAxisTick}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={chartAxisTick}
            tickFormatter={(value) => formatInsightNumber(Number(value))}
            width={38}
          />
          <Tooltip
            content={
              <ChartTooltip
                valuePrefix={valuePrefix}
                valueSuffix={valueSuffix}
              />
            }
          />
          <Bar dataKey="value" name="Value" radius={[8, 8, 0, 0]}>
            {data.map((point, index) => (
              <Cell
                key={point.label}
                fill={
                  point.color ?? defaultColors[index % defaultColors.length]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HorizontalBarList({
  data,
  valuePrefix = '',
  valueSuffix = '',
}: {
  data: InsightBreakdownPoint[]
  valuePrefix?: string
  valueSuffix?: string
}) {
  if (!data.length) return <EmptyChartState label="No breakdown data yet." />

  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const color = item.color ?? defaultColors[index % defaultColors.length]
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="text-chart font-medium">{item.label}</p>
                {item.helper ? (
                  <p className="text-neutral-text-secondary text-xs">
                    {item.helper}
                  </p>
                ) : null}
              </div>
              <span className="text-chart shrink-0 font-semibold">
                {valuePrefix}
                {formatInsightNumber(item.value)}
                {valueSuffix}
              </span>
            </div>
            <div className="bg-chart-track h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full shadow-[0_0_18px_rgba(34,211,238,0.22)] transition-all duration-300"
                style={{
                  width: `${Math.max((item.value / max) * 100, 5)}%`,
                  background: `linear-gradient(90deg, ${color}, #8b5cf6)`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DonutBreakdown({
  data,
  centerLabel,
  centerValue,
  activeLabel,
  onSelect,
}: {
  data: InsightBreakdownPoint[]
  centerLabel?: string
  centerValue?: string
  activeLabel?: string | null
  onSelect?: (item: InsightBreakdownPoint) => void
}) {
  if (!data.length) return <EmptyChartState label="No breakdown data yet." />

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={3}
            >
              {data.map((point, index) => (
                <Cell
                  key={point.label}
                  fill={
                    point.color ?? defaultColors[index % defaultColors.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-chart text-lg font-semibold">
              {centerValue}
            </span>
            {centerLabel ? (
              <span className="text-neutral-text-secondary text-xs">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        {data.map((item, index) => {
          const content = (
            <>
              <span className="text-chart-muted flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.color ?? defaultColors[index % defaultColors.length],
                  }}
                />
                {item.label}
              </span>
              <span className="text-chart font-semibold">{item.value}</span>
            </>
          )

          if (onSelect) {
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={activeLabel === item.label}
                onClick={() => onSelect(item)}
                className={cn(
                  'recommendation-card-surface flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition hover:border-cyan-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                  activeLabel === item.label &&
                    'border-cyan-500/45 bg-cyan-500/10',
                )}
              >
                {content}
              </button>
            )
          }

          return (
            <div
              key={item.label}
              className="recommendation-card-surface flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProgressMetricCard({
  label,
  value,
  helper,
  progress,
  tone = 'cyan',
}: {
  label: string
  value: string
  helper: string
  progress: number
  tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose'
}) {
  const toneClass = {
    cyan: 'from-cyan-300 to-blue-500 shadow-cyan-400/20',
    purple: 'from-violet-300 to-fuchsia-500 shadow-violet-400/20',
    green: 'from-emerald-300 to-teal-500 shadow-emerald-400/20',
    amber: 'from-amber-300 to-orange-500 shadow-amber-400/20',
    rose: 'from-rose-300 to-red-500 shadow-rose-400/20',
  }[tone]

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-neutral-text-secondary text-xs font-medium">
            {label}
          </p>
          <p className="text-metric mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="border-app bg-app-surface-muted text-app-secondary rounded-full border px-2 py-1 text-xs">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="bg-chart-track mt-4 h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r shadow-lg',
            toneClass,
          )}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
      <p className="text-neutral-text-secondary mt-2 text-xs">{helper}</p>
    </Card>
  )
}

export function FunnelVisual({
  data,
  valuePrefix = '',
  valueSuffix = '',
}: {
  data: InsightBreakdownPoint[]
  valuePrefix?: string
  valueSuffix?: string
}) {
  if (!data.length) return <EmptyChartState label="No funnel data yet." />

  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = Math.max((item.value / max) * 100, 16)
        const color = item.color ?? defaultColors[index % defaultColors.length]

        return (
          <div
            key={item.label}
            className="grid gap-2 sm:grid-cols-[150px_1fr_90px] sm:items-center"
          >
            <div>
              <p className="text-chart text-sm font-medium">{item.label}</p>
              {item.helper ? (
                <p className="text-neutral-text-secondary text-xs">
                  {item.helper}
                </p>
              ) : null}
            </div>
            <div className="border-app bg-chart-track h-9 overflow-hidden rounded-xl border">
              <div
                className="flex h-full items-center rounded-xl px-3 text-xs font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition-all duration-300"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${color}, #8b5cf6)`,
                }}
              >
                Stage {index + 1}
              </div>
            </div>
            <p className="text-chart text-right text-sm font-semibold sm:text-left">
              {valuePrefix}
              {formatInsightNumber(item.value)}
              {valueSuffix}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function SignalMatrix({
  data,
  columns = 3,
}: {
  data: Array<{
    label: string
    value: string
    helper?: string
    tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose' | 'slate'
    onClick?: () => void
    active?: boolean
  }>
  columns?: 2 | 3 | 4
}) {
  if (!data.length) return <EmptyChartState label="No signal data yet." />

  const toneClass = {
    cyan: 'border-cyan-500/25 bg-status-info-surface text-metric',
    purple: 'border-violet-500/25 bg-status-violet-surface text-metric',
    green: 'border-emerald-500/25 bg-status-success-surface text-metric',
    amber: 'border-amber-500/30 bg-status-warning-surface text-metric',
    rose: 'border-rose-500/25 bg-status-danger-surface text-metric',
    slate: 'border-app bg-app-surface-raised text-metric',
  }

  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 xl:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 xl:grid-cols-4',
      )}
    >
      {data.map((item) => {
        const content = (
          <>
            <p className="text-xs font-medium opacity-80">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            {item.helper ? (
              <p className="mt-1 text-xs opacity-75">{item.helper}</p>
            ) : null}
          </>
        )
        const className = cn(
          'rounded-2xl border p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25',
          toneClass[item.tone ?? 'slate'],
          item.active && 'ring-2 ring-cyan-300/35',
        )

        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={item.active}
              onClick={item.onClick}
              className={cn(
                className,
                'text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
              )}
            >
              {content}
            </button>
          )
        }

        return (
          <div key={item.label} className={className}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export function StageRail({
  data,
  selectedLabel,
  onSelect,
}: {
  data: Array<{
    label: string
    value: string
    helper?: string
    description?: string
    active?: boolean
    tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose'
  }>
  selectedLabel?: string | null
  onSelect?: (item: {
    label: string
    value: string
    helper?: string
    description?: string
    active?: boolean
    tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose'
  }) => void
}) {
  if (!data.length) return <EmptyChartState label="No stage data yet." />

  const toneClass = {
    cyan: 'border-cyan-500/40 bg-status-info-surface',
    purple: 'border-violet-500/40 bg-status-violet-surface',
    green: 'border-emerald-500/40 bg-status-success-surface',
    amber: 'border-amber-500/40 bg-status-warning-surface',
    rose: 'border-rose-500/40 bg-status-danger-surface',
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {data.map((item) => {
        const active = selectedLabel === item.label || item.active
        const descriptionId = item.description
          ? `stage-rail-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-description`
          : undefined
        const content = (
          <>
            <p className="text-metric text-sm font-semibold">{item.label}</p>
            <p className="text-metric mt-3 text-2xl font-semibold">
              {item.value}
            </p>
            {item.helper ? (
              <p className="text-neutral-text-secondary mt-1 text-xs">
                {item.helper}
              </p>
            ) : null}
            {item.description ? (
              <p
                id={descriptionId}
                className="text-neutral-text-secondary mt-2 text-xs leading-5"
              >
                {item.description}
              </p>
            ) : null}
          </>
        )
        const className = cn(
          'relative rounded-2xl border border-app bg-app-surface-raised p-4',
          active && toneClass[item.tone ?? 'cyan'],
          selectedLabel === item.label && 'ring-2 ring-cyan-300/35',
        )

        if (onSelect) {
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={selectedLabel === item.label}
              aria-describedby={descriptionId}
              onClick={() => onSelect(item)}
              className={cn(
                className,
                'hover:bg-app-surface-hover text-left transition hover:-translate-y-0.5 hover:border-cyan-500/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
              )}
            >
              {content}
            </button>
          )
        }

        return (
          <div key={item.label} className={className}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export function TimelineStrip({
  data,
}: {
  data: Array<{
    label: string
    value: number
    failed?: number
  }>
}) {
  if (!data.length) return <EmptyChartState label="No timeline data yet." />

  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
      {data.map((item) => {
        const intensity = Math.max(item.value / max, 0.12)
        const hasFailure = Boolean(item.failed && item.failed > 0)
        return (
          <div key={item.label} className="space-y-2">
            <div
              className={cn(
                'h-24 rounded-2xl border transition duration-200 hover:-translate-y-0.5',
                hasFailure
                  ? 'border-rose-300/30 bg-rose-400/[0.08]'
                  : 'border-cyan-300/20 bg-cyan-300/[0.06]',
              )}
              style={{
                boxShadow: `inset 0 -${Math.round(intensity * 70)}px 0 ${
                  hasFailure
                    ? 'rgba(251,113,133,0.18)'
                    : 'rgba(34,211,238,0.18)'
                }`,
              }}
            />
            <div className="text-center">
              <p className="text-chart text-xs font-medium">{item.value}</p>
              <p className="text-neutral-text-secondary text-[10px]">
                {item.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RecommendedActionsCard({
  title = 'Recommended Actions',
  description,
  actions,
}: {
  title?: string
  description?: string
  actions: Array<{
    title: string
    detail: string
    tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose'
    cta?: string
    onClick?: () => void
  }>
}) {
  if (!actions.length) return null

  const dotClass = {
    cyan: 'bg-cyan-300',
    purple: 'bg-violet-300',
    green: 'bg-emerald-300',
    amber: 'bg-amber-300',
    rose: 'bg-rose-300',
  }

  return (
    <Card className="border-cyan-300/15 bg-cyan-300/[0.035] p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-insight text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-neutral-text-secondary text-sm">{description}</p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={action.onClick}
            className="recommendation-card-surface group rounded-2xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  dotClass[action.tone ?? 'cyan'],
                )}
              />
              <div className="min-w-0">
                <p className="text-app-primary text-sm font-medium">
                  {action.title}
                </p>
                <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
                  {action.detail}
                </p>
                {action.cta ? (
                  <p className="mt-2 text-xs font-medium text-cyan-700 transition group-hover:text-cyan-800 dark:text-cyan-200 dark:group-hover:text-cyan-100">
                    {action.cta}
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}

export function SavedViewTabs({
  views,
  activeViewId,
  onSelect,
  trailingAction,
}: {
  views: Array<{
    id: string
    label: string
    count?: number
    tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose' | 'slate'
  }>
  activeViewId?: string | null
  onSelect: (viewId: string) => void
  trailingAction?: React.ReactNode
}) {
  if (!views.length) return null

  const activeClass = {
    cyan: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-100',
    purple:
      'border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-100',
    green:
      'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100',
    amber:
      'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-100',
    rose: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-100',
    slate: 'border-app-strong bg-app-surface-muted text-app-primary',
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {views.map((view) => {
          const active = activeViewId === view.id
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onSelect(view.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:hover:text-cyan-100',
                active
                  ? activeClass[view.tone ?? 'cyan']
                  : 'border-app bg-app-surface-raised text-neutral-text-secondary',
              )}
            >
              {view.label}
              {typeof view.count === 'number' ? (
                <span className="border-app bg-app-surface-muted rounded-full border px-1.5 py-0.5 text-[10px]">
                  {view.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
    </div>
  )
}

export function ActiveFilterChips({
  filters,
  onClear,
}: {
  filters: Array<{ label: string; value?: string }>
  onClear: () => void
}) {
  if (!filters.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
      <span className="text-xs font-medium text-cyan-700 dark:text-cyan-100">
        Active view
      </span>
      {filters.map((filter) => (
        <span
          key={`${filter.label}-${filter.value ?? ''}`}
          className="border-app bg-app-surface-raised text-app-secondary rounded-full border px-2.5 py-1 text-xs"
        >
          {filter.label}
          {filter.value ? `: ${filter.value}` : ''}
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="border-app bg-app-surface-raised text-neutral-text-secondary rounded-full border px-2.5 py-1 text-xs transition hover:border-cyan-500/40 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:hover:text-cyan-100"
      >
        Clear filter
      </button>
    </div>
  )
}

export type TimelineEvent = {
  id: string
  title: string
  description?: string
  timestamp?: string
  actor?: string
  tone?: 'cyan' | 'purple' | 'green' | 'amber' | 'rose' | 'slate'
  category?: string
}

export function RecordTimeline({
  events,
  emptyLabel = 'No activity yet.',
}: {
  events: TimelineEvent[]
  emptyLabel?: string
}) {
  if (!events.length) {
    return (
      <div className="border-app bg-app-surface-muted text-neutral-text-secondary rounded-2xl border border-dashed px-4 py-5 text-sm">
        {emptyLabel}
      </div>
    )
  }

  const dotClass = {
    cyan: 'bg-cyan-300',
    purple: 'bg-violet-300',
    green: 'bg-emerald-300',
    amber: 'bg-amber-300',
    rose: 'bg-rose-300',
    slate: 'bg-slate-500',
  }

  const groupedEvents = events.reduce<Record<string, TimelineEvent[]>>(
    (groups, event) => {
      const category = event.category ?? 'General Activity'
      groups[category] = [...(groups[category] ?? []), event]
      return groups
    },
    {},
  )
  const categoryOrder = [
    'Lead Pipeline',
    'Opportunity Pipeline',
    'Sales Pipeline',
    'Client Activity',
    'General Activity',
  ]
  const orderedGroups = [
    ...categoryOrder.filter((category) => groupedEvents[category]?.length),
    ...Object.keys(groupedEvents).filter(
      (category) => !categoryOrder.includes(category),
    ),
  ]

  return (
    <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
      {orderedGroups.map((category) => (
        <div key={category} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-100/70">
            {category}
          </p>
          {groupedEvents[category].map((event) => (
            <div key={event.id} className="flex gap-3">
              <span
                className={cn(
                  'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_16px_rgba(34,211,238,0.28)]',
                  dotClass[event.tone ?? 'cyan'],
                )}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-app-primary text-sm font-medium">
                    {event.title}
                  </p>
                  {event.timestamp ? (
                    <span className="text-neutral-text-secondary text-[11px]">
                      {event.timestamp}
                    </span>
                  ) : null}
                </div>
                {event.description ? (
                  <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
                    {event.description}
                  </p>
                ) : null}
                {event.actor ? (
                  <p className="mt-1 text-[11px] text-cyan-700 dark:text-cyan-100/75">
                    {event.actor}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export type LinkedRecordCardItem = {
  label: string
  value: string
  helper?: string
  href?: string
  onClick?: () => void
}

export function LinkedRecordsCard({
  title = 'Connected Records',
  records,
  compactLimit = 3,
  explorerLabel = 'View Related',
}: {
  title?: string
  records: LinkedRecordCardItem[]
  compactLimit?: number
  explorerLabel?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  if (!records.length) return null
  const visibleRecords = isExpanded ? records : records.slice(0, compactLimit)
  const hiddenCount = Math.max(records.length - visibleRecords.length, 0)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-app-primary text-sm font-semibold">{title}</h2>
        {records.length > compactLimit ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-700 transition hover:border-cyan-500/40 hover:bg-cyan-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 dark:text-cyan-100"
          >
            {isExpanded ? 'Show Less' : `${explorerLabel} · ${records.length}`}
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {visibleRecords.map((record) => {
          const content = (
            <>
              <div className="min-w-0">
                <p className="text-neutral-text-secondary text-xs">
                  {record.label}
                </p>
                <p className="text-app-primary mt-0.5 truncate text-sm font-medium">
                  {record.value}
                </p>
                {record.helper ? (
                  <p className="text-neutral-text-secondary mt-0.5 text-xs">
                    {record.helper}
                  </p>
                ) : null}
              </div>
              <span className="text-cyan-700 dark:text-cyan-100/70">→</span>
            </>
          )

          if (record.href) {
            return (
              <a
                key={`${record.label}-${record.value}`}
                href={record.href}
                className="recommendation-card-surface flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                {content}
              </a>
            )
          }

          return (
            <button
              key={`${record.label}-${record.value}`}
              type="button"
              onClick={record.onClick}
              className="recommendation-card-surface flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              {content}
            </button>
          )
        })}
      </div>
      {!isExpanded && hiddenCount > 0 ? (
        <p className="text-neutral-text-secondary mt-2 text-xs">
          {hiddenCount} more related {hiddenCount === 1 ? 'record' : 'records'}{' '}
          available.
        </p>
      ) : null}
    </Card>
  )
}

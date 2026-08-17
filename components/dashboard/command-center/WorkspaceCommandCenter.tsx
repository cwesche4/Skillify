'use client'

import Link from 'next/link'
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Bot,
  ChevronRight,
  Clock3,
  DollarSign,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react'

import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { RecommendedActionsCard } from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { cn } from '@/lib/utils'
import { formatWorkspaceCompactDate } from '@/lib/formatting/dates'
import { demoTaskToday, type TaskRecord } from '@/lib/tasks/demoTasks'
import {
  type LeadRecord,
  type OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import { readPreviewLeads } from '@/lib/sales/previewLeadStorage'
import { getMergedWorkspaceOpportunities } from '@/lib/sales/previewOpportunityStorage'
import type { WorkspaceClient } from '@/lib/clients/types'
import { readPreviewClients } from '@/lib/clients/previewClientStorage'
import {
  getDashboardPriorityTasks,
  getDueOrOverdueOpenTasks,
  getOpenServiceRequests,
  getUrgentOpenServiceRequests,
  selectOpenOpportunities,
  selectWonOpportunities,
  sortTaskLikeByDueDatePriority,
} from '@/lib/workspace-records/relationships'
import { readPreviewTasks } from '@/lib/tasks/previewTaskStorage'
import { readPreviewServiceRequests } from '@/lib/service-requests/previewServiceRequestStorage'
import {
  commercePreviewCustomersChangedEvent,
  commercePreviewFulfillmentsChangedEvent,
  commercePreviewOrdersChangedEvent,
  commercePreviewProductsChangedEvent,
  commercePreviewSettingsChangedEvent,
  getPreviewCustomers,
  getPreviewCommerceSettings,
  getPreviewFulfillmentActivities,
  getPreviewFulfillments,
  getPreviewOrderActivities,
  getPreviewOrders,
  getPreviewProductActivities,
  getPreviewProducts,
} from '@/lib/commerce/previewCommerceStorage'
import {
  getOrderCustomerLabel,
  selectOrderCounts,
} from '@/lib/commerce/orderCatalog'
import { selectFulfillmentCounts } from '@/lib/commerce/fulfillmentCatalog'
import {
  calculateOrderFinancialsFromOrder,
  summarizeOrderFinancials,
} from '@/lib/commerce/calculateOrderFinancials'
import {
  getProductInventoryState,
  selectProductCounts,
} from '@/lib/commerce/productCatalog'
import { formatProductPriceRange } from '@/lib/commerce/productPricing'
import type {
  CommerceCustomer,
  CommerceFulfillment,
  CommerceOrder,
  CommercePreviewSettings,
  CommerceProduct,
} from '@/lib/commerce/types'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import {
  isWorkspaceCrmRecordsChangedEvent,
  workspaceCrmRecordsChangedEvent,
} from '@/lib/workspace-records/previewEvents'
import {
  createDemoWorkspaceOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'

function formatServiceRequestDate(value: string | null) {
  if (!value) return 'Not scheduled'

  return formatWorkspaceCompactDate(value)
}

function formatInventoryState(state: string) {
  if (state === 'IN_STOCK') return 'In Stock'
  if (state === 'LOW_STOCK') return 'Low Stock'
  if (state === 'OUT_OF_STOCK') return 'Out of Stock'
  return 'Not Tracked'
}

export type DashboardKpi = {
  id?: string
  label: string
  value: string
  helper: string
  trend?: string
  trendHref?: string
  tone?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate'
  href?: string
}

export type ChartPoint = {
  label: string
  rangeLabel?: string
  revenue?: number
  previousRevenue?: number
  pipeline?: number
  won?: number
  lost?: number
  leads?: number
  success?: number
  failed?: number
  value?: number
}

export type DashboardRevenueInsight = {
  label: string
  value: string
  tone?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate'
}

export type BreakdownPoint = {
  label: string
  value: number
}

export type DashboardAttention = {
  title: string
  workflowName: string
  issue: string
  time: string
  failureHref: string
  workflowHref: string
} | null

export type DashboardActivity = {
  id: string
  title: string
  description: string
  time: string
  status: 'Success' | 'Failed' | 'Pending' | 'Info'
  href?: string
  executionHref?: string
  workflowHref?: string
  workflowName?: string
  startedAt?: string
  duration?: string
  trigger?: string
  source?: string
  errorMessage?: string
  steps?: string
}

export type DashboardInsight = {
  id: string
  text: string
  tone: BadgeVariant
}

export type DashboardTaskSummary = {
  id?: string
  title: string
  due: string
  owner: string
  priority: TaskRecord['priority']
  status?: string
  source?: string
  relatedRecord?: string
  description?: string
}

export type DashboardClientSummary = {
  id?: string
  opportunityId?: string
  name: string
  company: string
  status: string
  value: string
  health?: string
  openTasks?: number
  lastActivity?: string
  nextAction?: string
  tags?: string[]
  nextStepLabel?: string
}

export type DashboardLeadPreview = {
  id: string
  name: string
  company: string
  owner: string
  value: string
  status: string
  followUp: string
}

export type DashboardLeadRecord = DashboardLeadPreview & {
  followUpDue?: string
}

export type DashboardServiceRequestPreview = {
  id: string
  customer: string
  company: string
  priority: string
  status: string
  scheduled: string
  owner: string
}

export type DashboardProductSummary = {
  id: string
  name: string
  status: string
  price: string
  inventoryState: string
  updated: string
}

export type DashboardOrderSummary = {
  id: string
  orderNumber: string
  customer: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  total: string
  updated: string
}

export type WorkspaceCommandCenterData = {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  commerceEnabled?: boolean
  modules?: {
    leads: boolean
    opportunities: boolean
    sales: boolean
    clients: boolean
    serviceRequests: boolean
    tasks: boolean
  }
  terminology?: {
    leadPlural: string
    opportunityPlural: string
    customerSingular: string
    customerPlural: string
    serviceRequestPlural: string
    taskPlural: string
    salesLabel: string
  }
  taskMetricScope?: 'all' | 'serviceRequestChildren'
  dataMode: 'real' | 'mixed' | 'empty'
  summary: string
  kpis: DashboardKpi[]
  attention: DashboardAttention
  revenueSeries: ChartPoint[]
  pipelineSeries: ChartPoint[]
  automationSeries: ChartPoint[]
  opportunityStages: BreakdownPoint[]
  leadSources: BreakdownPoint[]
  serviceTypes: BreakdownPoint[]
  serviceRequestStatus: BreakdownPoint[]
  serviceRequestSchedule: BreakdownPoint[]
  taskStatus: BreakdownPoint[]
  recentActivity: DashboardActivity[]
  aiInsights: DashboardInsight[]
  tasksDue: DashboardTaskSummary[]
  recentClients: DashboardClientSummary[]
  leads: DashboardLeadRecord[]
  followUpLeads: DashboardLeadPreview[]
  openServiceRequests: DashboardServiceRequestPreview[]
  recentProducts?: DashboardProductSummary[]
  productStatusBreakdown?: BreakdownPoint[]
  inventoryHealthBreakdown?: BreakdownPoint[]
  productsByCategory?: BreakdownPoint[]
  automationHealth: {
    successRate: string
    activeAutomations: number
    failedRuns: number
    avgDuration: string
  }
  revenueInsights: DashboardRevenueInsight[]
  revenueMonthlyInsights: Record<string, DashboardRevenueInsight[]>
}

const toneClasses: Record<NonNullable<DashboardKpi['tone']>, string> = {
  cyan: 'border-cyan-500/25 bg-status-info-surface',
  purple: 'border-violet-500/25 bg-status-violet-surface',
  emerald: 'border-emerald-500/25 bg-status-success-surface',
  amber: 'border-amber-500/30 bg-status-warning-surface',
  rose: 'border-rose-500/25 bg-status-danger-surface',
  slate: 'border-app bg-app-surface-raised',
}

const chartColors = ['#67e8f9', '#8b5cf6', '#22c55e', '#f59e0b', '#f43f5e']
const chartGridStroke = 'var(--chart-grid)'
const chartAxisTick = { fill: 'var(--chart-text-muted)', fontSize: 11 }
const chartSmallAxisTick = { fill: 'var(--chart-text-muted)', fontSize: 10 }

function formatChartCurrency(value: number) {
  if (value >= 1000) return `$${Math.round(value / 100) / 10}k`
  return `$${value}`
}

function DashboardEmptyState({ label }: { label: string }) {
  return (
    <div className="border-app bg-chart-surface flex h-56 items-center justify-center rounded-xl border border-dashed p-6 text-center">
      <div>
        <p className="text-chart text-sm font-medium">{label}</p>
        <p className="text-neutral-text-secondary mt-1 text-xs">
          Live workspace data will appear here as records are created.
        </p>
      </div>
    </div>
  )
}

function DashboardTooltip({
  currency,
  cursor = true,
}: {
  currency?: boolean
  cursor?: boolean
}) {
  return (
    <Tooltip
      cursor={
        cursor
          ? { fill: 'color-mix(in srgb, var(--primary) 8%, transparent)' }
          : false
      }
      labelFormatter={(_, payload) => {
        const rangeLabel = payload?.[0]?.payload?.rangeLabel
        return rangeLabel ?? payload?.[0]?.payload?.label ?? ''
      }}
      contentStyle={{
        backgroundColor: 'var(--chart-tooltip-surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 12,
        color: 'var(--chart-tooltip-text)',
        fontSize: 12,
        boxShadow: 'var(--shadow-card)',
      }}
      formatter={(value: unknown, name: unknown) => [
        currency && typeof value === 'number'
          ? formatChartCurrency(value)
          : String(value),
        String(name),
      ]}
    />
  )
}

function KpiCard({ item }: { item: DashboardKpi }) {
  const openCard = () => {
    if (item.href) window.location.href = item.href
  }
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!item.href) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openCard()
    }
  }
  const card = (
    <Card
      role={item.href ? 'link' : undefined}
      tabIndex={item.href ? 0 : undefined}
      onClick={item.href ? openCard : undefined}
      onKeyDown={item.href ? handleCardKeyDown : undefined}
      className={cn(
        'metric-card-surface min-h-[132px] border p-4 transition',
        item.href
          ? 'cursor-pointer focus-within:border-cyan-500/45 hover:-translate-y-0.5 hover:border-cyan-500/35'
          : '',
        toneClasses[item.tone ?? 'slate'],
      )}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className="text-neutral-text-secondary text-[11px] font-semibold uppercase tracking-[0.12em]">
            {item.label}
          </p>
          <p className="text-metric mt-2 text-2xl font-semibold">
            {item.value}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-neutral-text-secondary text-xs">{item.helper}</p>
          {item.trend || item.href ? (
            <span
              role={item.trendHref ? 'link' : undefined}
              tabIndex={item.trendHref ? 0 : undefined}
              onClick={
                item.trendHref
                  ? (event) => {
                      event.stopPropagation()
                      window.location.href = item.trendHref as string
                    }
                  : undefined
              }
              onKeyDown={
                item.trendHref
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        window.location.href = item.trendHref as string
                      }
                    }
                  : undefined
              }
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-700 dark:text-cyan-100',
                item.trendHref
                  ? 'cursor-pointer transition hover:border-cyan-500/40 hover:bg-cyan-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50'
                  : '',
              )}
              aria-label={
                item.trendHref ? `Open ${item.trend} leads` : undefined
              }
            >
              {item.trend}
              {item.href ? (
                <ChevronRight className="h-3 w-3 opacity-60" />
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  )

  if (!item.href) return card
  if (item.trendHref) return card

  return (
    <Link
      href={item.href}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      aria-label={`Open ${item.label}`}
    >
      {card}
    </Link>
  )
}

function getInsightHref(workspaceSlug: string, insight: DashboardInsight) {
  const text = insight.text.toLowerCase()

  if (insight.id.startsWith('commerce') || text.includes('catalog')) {
    return `/dashboard/${workspaceSlug}/products`
  }
  if (text.includes('lead')) {
    return `/dashboard/${workspaceSlug}/leads?view=needs-follow-up#leads-workspace`
  }
  if (text.includes('automation') || text.includes('failed')) {
    return `/dashboard/${workspaceSlug}/executions?view=failed#execution-history`
  }
  if (
    insight.id === 'requests' ||
    text.includes('service request') ||
    text.includes('request') ||
    text.includes('job')
  ) {
    return `/dashboard/${workspaceSlug}/service-requests?view=open#request-queue`
  }
  if (text.includes('task')) {
    return `/dashboard/${workspaceSlug}/tasks?view=overdue#tasks-workspace`
  }

  return `/dashboard/${workspaceSlug}/ai-coach?prompt=${encodeURIComponent(
    insight.text,
  )}`
}

type DashboardPreview =
  | { type: 'task'; task: DashboardTaskSummary }
  | { type: 'client'; client: DashboardClientSummary }
  | { type: 'insight'; insight: DashboardInsight }
  | { type: 'execution'; activity: DashboardActivity }

function preventCardClick(event: MouseEvent<HTMLElement>) {
  event.stopPropagation()
}

function PreviewShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/35 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dashboard preview"
        onClick={onClose}
      />
      <aside className="app-drawer relative flex h-full w-full max-w-xl flex-col border-l">
        <div className="border-app flex items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/80">
              Dashboard Preview
            </p>
            <h2 className="text-app-primary mt-2 text-lg font-semibold">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-app-muted mt-1 text-sm">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover rounded-lg border p-2 transition hover:border-cyan-500/40 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:hover:text-cyan-100"
            aria-label="Close dashboard preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {children}
        </div>
      </aside>
    </div>
  )
}

function PreviewField({
  label,
  value,
}: {
  label: string
  value?: React.ReactNode
}) {
  return (
    <div className="border-app bg-app-surface-muted rounded-xl border p-3">
      <p className="text-app-muted text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <div className="text-app-primary mt-1 text-sm font-medium">
        {value ?? '—'}
      </div>
    </div>
  )
}

function PreviewActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>
}

const previewButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:bg-cyan-500/15 dark:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50'

const previewSecondaryButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-app bg-app-surface-muted px-3 py-2 text-xs font-medium text-app-primary transition hover:border-cyan-500/35 hover:bg-app-surface-hover hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:hover:text-cyan-100'

function SectionCard({
  title,
  description,
  children,
  action,
  className,
  href,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
  href?: string
}) {
  const navigate = () => {
    if (href) window.location.href = href
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (
      target.closest(
        'a,button,input,select,textarea,[role="button"],[data-prevent-card-click="true"]',
      )
    ) {
      return
    }
    navigate()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!href) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate()
    }
  }

  return (
    <Card
      role={href ? 'link' : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={href ? handleClick : undefined}
      onKeyDown={href ? handleKeyDown : undefined}
      className={cn(
        'border-app bg-chart-surface p-5 shadow-[var(--shadow-card)] transition',
        href
          ? 'hover:bg-app-surface-hover cursor-pointer hover:border-cyan-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45'
          : '',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-chart text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {description}
            </p>
          ) : null}
        </div>
        <div data-prevent-card-click="true">{action}</div>
      </div>
      {children}
    </Card>
  )
}

function RevenueChart({
  data,
  selectedLabel = null,
  onSelect,
  showPipeline = true,
}: {
  data: ChartPoint[]
  selectedLabel?: string | null
  onSelect?: (label: string) => void
  showPipeline?: boolean
}) {
  if (data.length === 0) return <DashboardEmptyState label="No revenue yet" />
  const handleSelect = (state: unknown) => {
    if (!onSelect) return
    const label = (state as { activeLabel?: string } | null)?.activeLabel
    if (label) onSelect(label)
  }
  return (
    <div
      className="h-72 select-none outline-none focus:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_.recharts-surface]:outline-none [&_.recharts-surface]:focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper]:focus:outline-none [&_svg]:outline-none [&_svg]:focus:outline-none"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 12, top: 8 }}
          onMouseMove={handleSelect}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#67e8f9" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="pipelineGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartGridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={chartAxisTick}
          />
          <YAxis
            tickFormatter={formatChartCurrency}
            tickLine={false}
            axisLine={false}
            tick={chartAxisTick}
            width={42}
          />
          <DashboardTooltip currency cursor={false} />
          {showPipeline ? (
            <Area
              type="monotone"
              dataKey="pipeline"
              name="Open pipeline"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#pipelineGradient)"
              activeDot={(props: any) => {
                const label = props.payload?.label
                return (
                  <circle
                    {...props}
                    r={label === selectedLabel ? 5 : 4}
                    fill="#8b5cf6"
                    stroke="#e0e7ff"
                    strokeWidth={label === selectedLabel ? 2 : 1}
                  />
                )
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="revenue"
            name="Won revenue"
            stroke="#67e8f9"
            strokeWidth={2.4}
            fill="url(#revenueGradient)"
            activeDot={(props: any) => {
              const label = props.payload?.label
              return (
                <circle
                  {...props}
                  r={label === selectedLabel ? 5 : 4}
                  fill="#67e8f9"
                  stroke="#ecfeff"
                  strokeWidth={label === selectedLabel ? 2 : 1}
                />
              )
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function AutomationHealthChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return <DashboardEmptyState label="No runs yet" />
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke={chartGridStroke} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={chartAxisTick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={chartAxisTick}
            width={28}
          />
          <DashboardTooltip />
          <Line
            type="monotone"
            dataKey="success"
            name="Successful"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke="#f43f5e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function groupAutomationSeriesByWeek(data: ChartPoint[]): ChartPoint[] {
  const weeklySource = data.slice(-30)
  const bucketSize = Math.ceil(weeklySource.length / 4) || 1

  return Array.from({ length: 4 }).reduce<ChartPoint[]>((buckets, _, index) => {
    const points = weeklySource.slice(
      index * bucketSize,
      (index + 1) * bucketSize,
    )
    if (points.length === 0) return buckets
    const first = points[0]
    const last = points[points.length - 1]
    buckets.push({
      label: `Week ${index + 1}`,
      rangeLabel: `${first.rangeLabel ?? first.label} - ${
        last.rangeLabel ?? last.label
      }`,
      success: points.reduce((total, point) => total + (point.success ?? 0), 0),
      failed: points.reduce((total, point) => total + (point.failed ?? 0), 0),
    })
    return buckets
  }, [])
}

function CompactBarChart({
  data,
  valueLabel,
  currency,
  hrefForItem,
}: {
  data: BreakdownPoint[]
  valueLabel: string
  currency?: boolean
  hrefForItem?: (item: BreakdownPoint) => string
}) {
  if (data.length === 0) return <DashboardEmptyState label="No data yet" />
  return (
    <div className="space-y-4">
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke={chartGridStroke} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={chartSmallAxisTick}
            />
            <YAxis
              tickFormatter={currency ? formatChartCurrency : undefined}
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              width={38}
            />
            <DashboardTooltip currency={currency} />
            <Bar
              dataKey="value"
              name={valueLabel}
              radius={[8, 8, 0, 0]}
              fill="#67e8f9"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hrefForItem ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.map((item) => (
            <Link
              key={item.label}
              href={hrefForItem(item)}
              className="recommendation-card-surface group rounded-xl border px-3 py-2 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-app-primary truncate text-xs font-medium">
                  {item.label}
                </span>
                <span className="text-xs text-cyan-700 opacity-80 group-hover:opacity-100 dark:text-cyan-100">
                  View →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DonutChart({
  data,
  hrefForItem,
}: {
  data: BreakdownPoint[]
  hrefForItem?: (item: BreakdownPoint) => string
}) {
  if (data.length === 0) return <DashboardEmptyState label="No sources yet" />
  return (
    <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={42}
              outerRadius={68}
              paddingAngle={3}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Pie>
            <DashboardTooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 self-center">
        {data.map((item, index) => {
          const content = (
            <>
              <span className="text-chart-muted flex min-w-0 items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: chartColors[index % chartColors.length],
                  }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-chart text-xs font-medium">
                {item.value}
              </span>
            </>
          )

          return hrefForItem ? (
            <Link
              key={item.label}
              href={hrefForItem(item)}
              className="flex items-center justify-between rounded-lg px-2 py-1 transition hover:bg-cyan-300/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label={`View ${item.label}`}
            >
              {content}
            </Link>
          ) : (
            <div
              key={item.label}
              className="flex items-center justify-between px-2 py-1"
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WorkspaceCommandCenter({
  data,
}: {
  data: WorkspaceCommandCenterData
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [smartStatus, setSmartStatus] = useState<string | null>(null)
  const [preview, setPreview] = useState<DashboardPreview | null>(null)
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)
  const [previewTasks, setPreviewTasks] = useState<TaskRecord[]>([])
  const [previewLeads, setPreviewLeads] = useState<LeadRecord[]>([])
  const [previewOpportunities, setPreviewOpportunities] = useState<
    OpportunityRecord[]
  >([])
  const [previewClients, setPreviewClients] = useState<WorkspaceClient[]>([])
  const [previewServiceRequests, setPreviewServiceRequests] = useState<
    WorkspaceServiceRequest[]
  >([])
  const [previewProducts, setPreviewProducts] = useState<CommerceProduct[]>([])
  const [previewOrders, setPreviewOrders] = useState<CommerceOrder[]>([])
  const [previewFulfillments, setPreviewFulfillments] = useState<
    CommerceFulfillment[]
  >([])
  const [previewCommerceCustomers, setPreviewCommerceCustomers] = useState<
    CommerceCustomer[]
  >([])
  const [previewCommerceSettings, setPreviewCommerceSettings] =
    useState<CommercePreviewSettings | null>(null)
  const [automationRange, setAutomationRange] = useState<'7d' | '30d'>('7d')
  const [jobAnalyticsView, setJobAnalyticsView] = useState<
    'type' | 'schedule' | 'status'
  >('type')
  const modules = data.modules ?? {
    leads: true,
    opportunities: true,
    sales: true,
    clients: true,
    serviceRequests: true,
    tasks: true,
  }
  const terminology = data.terminology ?? {
    leadPlural: 'Leads',
    opportunityPlural: 'Opportunities',
    customerSingular: 'Client',
    customerPlural: 'Clients',
    serviceRequestPlural: 'Service Requests',
    taskPlural: 'Tasks',
    salesLabel: 'Sales',
  }
  const isServiceBusinessDashboard =
    data.taskMetricScope === 'serviceRequestChildren' &&
    modules.clients &&
    modules.serviceRequests &&
    modules.tasks &&
    !modules.opportunities &&
    !modules.sales
  const latestRevenueMonth = data.revenueSeries.at(-1)?.label ?? null
  const [selectedRevenueMonth, setSelectedRevenueMonth] = useState<
    string | null
  >(latestRevenueMonth)

  useEffect(() => {
    setSelectedRevenueMonth(latestRevenueMonth)
  }, [latestRevenueMonth])

  useEffect(() => {
    setPreviewTasks(readPreviewTasks(data.workspaceSlug))
    setPreviewLeads(readPreviewLeads(data.workspaceSlug))
    setPreviewOpportunities(getMergedWorkspaceOpportunities(data.workspaceSlug))
    setPreviewClients(readPreviewClients(data.workspaceSlug))
    setPreviewServiceRequests(readPreviewServiceRequests(data.workspaceSlug))
    if (data.commerceEnabled) {
      setPreviewProducts(getPreviewProducts(data.workspaceId))
      setPreviewOrders(getPreviewOrders(data.workspaceId))
      setPreviewFulfillments(getPreviewFulfillments(data.workspaceId))
      setPreviewCommerceCustomers(getPreviewCustomers(data.workspaceId))
      setPreviewCommerceSettings(getPreviewCommerceSettings(data.workspaceId))
    }
  }, [data.commerceEnabled, data.workspaceId, data.workspaceSlug])

  useEffect(() => {
    if (!data.commerceEnabled) return
    const onCommerceChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (!detail?.workspaceId || detail.workspaceId === data.workspaceId) {
        setPreviewProducts(getPreviewProducts(data.workspaceId))
        setPreviewOrders(getPreviewOrders(data.workspaceId))
        setPreviewFulfillments(getPreviewFulfillments(data.workspaceId))
        setPreviewCommerceCustomers(getPreviewCustomers(data.workspaceId))
        setPreviewCommerceSettings(getPreviewCommerceSettings(data.workspaceId))
      }
    }
    window.addEventListener(
      commercePreviewProductsChangedEvent,
      onCommerceChanged,
    )
    window.addEventListener(
      commercePreviewOrdersChangedEvent,
      onCommerceChanged,
    )
    window.addEventListener(
      commercePreviewFulfillmentsChangedEvent,
      onCommerceChanged,
    )
    window.addEventListener(
      commercePreviewCustomersChangedEvent,
      onCommerceChanged,
    )
    window.addEventListener(
      commercePreviewSettingsChangedEvent,
      onCommerceChanged,
    )
    window.addEventListener('storage', onCommerceChanged)
    return () => {
      window.removeEventListener(
        commercePreviewProductsChangedEvent,
        onCommerceChanged,
      )
      window.removeEventListener(
        commercePreviewOrdersChangedEvent,
        onCommerceChanged,
      )
      window.removeEventListener(
        commercePreviewFulfillmentsChangedEvent,
        onCommerceChanged,
      )
      window.removeEventListener(
        commercePreviewCustomersChangedEvent,
        onCommerceChanged,
      )
      window.removeEventListener(
        commercePreviewSettingsChangedEvent,
        onCommerceChanged,
      )
      window.removeEventListener('storage', onCommerceChanged)
    }
  }, [data.commerceEnabled, data.workspaceId])

  useEffect(() => {
    const handleCrmRecordsChanged = (event: Event) => {
      if (!isWorkspaceCrmRecordsChangedEvent(event)) return
      if (event.detail.workspaceId !== data.workspaceSlug) return

      if (event.detail.scope === 'tasks') {
        setPreviewTasks(readPreviewTasks(data.workspaceSlug))
      }
      if (event.detail.scope === 'leads') {
        setPreviewLeads(readPreviewLeads(data.workspaceSlug))
      }
      if (event.detail.scope === 'opportunities') {
        setPreviewOpportunities(
          getMergedWorkspaceOpportunities(data.workspaceSlug),
        )
      }
      if (event.detail.scope === 'clients') {
        setPreviewClients(readPreviewClients(data.workspaceSlug))
      }
      if (event.detail.scope === 'serviceRequests') {
        setPreviewServiceRequests(
          readPreviewServiceRequests(data.workspaceSlug),
        )
      }
    }

    window.addEventListener(
      workspaceCrmRecordsChangedEvent,
      handleCrmRecordsChanged,
    )
    return () =>
      window.removeEventListener(
        workspaceCrmRecordsChangedEvent,
        handleCrmRecordsChanged,
      )
  }, [data.workspaceSlug])

  const scopedPreviewTasks = useMemo(
    () =>
      data.taskMetricScope === 'serviceRequestChildren'
        ? previewTasks.filter((task) => task.parentType === 'serviceRequest')
        : previewTasks,
    [data.taskMetricScope, previewTasks],
  )

  const localDueOrOverdueTasks = useMemo(
    () => getDueOrOverdueOpenTasks(scopedPreviewTasks),
    [scopedPreviewTasks],
  )

  const localPriorityTasks = useMemo<DashboardTaskSummary[]>(
    () =>
      getDashboardPriorityTasks(scopedPreviewTasks)
        .slice(0, 5)
        .map((task) => ({
          id: task.id,
          title: task.title,
          due: task.dueDate,
          owner: task.clientName ?? task.relatedRecordLabel,
          priority: task.priority,
          status: task.status,
          source: task.source,
          relatedRecord: task.clientName ?? task.relatedRecordLabel,
          description: task.description,
        })),
    [scopedPreviewTasks],
  )

  const tasksDue = useMemo(() => {
    const previewTaskIds = new Set(scopedPreviewTasks.map((task) => task.id))
    const seen = new Set<string>()
    return sortTaskLikeByDueDatePriority(
      [
        ...localPriorityTasks,
        ...data.tasksDue.filter(
          (task) => !task.id || !previewTaskIds.has(task.id),
        ),
      ].filter((task) => {
        const key = task.id ?? `${task.title}-${task.due}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }),
    )
  }, [data.tasksDue, localPriorityTasks, scopedPreviewTasks])

  const openServiceRequests = useMemo(() => {
    const localRequests: DashboardServiceRequestPreview[] =
      getOpenServiceRequests(previewServiceRequests).map((request) => ({
        id: request.id,
        customer: request.customerName,
        company: request.company,
        priority: request.priority,
        status: request.status,
        scheduled: formatServiceRequestDate(request.scheduledFor),
        owner: getOwnerName(
          createDemoWorkspaceOwners(request.workspaceId),
          request.assignedToOwnerId,
        ),
      }))

    const seen = new Set<string>()
    const previewRequestIds = new Set(
      previewServiceRequests.map((request) => request.id),
    )
    return [
      ...localRequests,
      ...data.openServiceRequests.filter(
        (request) => !previewRequestIds.has(request.id),
      ),
    ].filter((request) => {
      if (seen.has(request.id)) return false
      seen.add(request.id)
      return true
    })
  }, [data.openServiceRequests, previewServiceRequests])

  const dashboardLeadRecords = useMemo<DashboardLeadRecord[]>(() => {
    const owners = createDemoWorkspaceOwners(data.workspaceSlug)
    const formattedPreviewLeads = previewLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      owner: getOwnerName(owners, lead.ownerId),
      value: formatChartCurrency(lead.value),
      status: lead.status,
      followUpDue: lead.followUpDue,
      followUp: lead.followUpDue
        ? lead.followUpDue === demoTaskToday
          ? 'Due today'
          : lead.followUpDue < demoTaskToday
            ? 'Overdue'
            : lead.followUpDue
        : 'Pending outreach',
    }))
    const previewLeadIds = new Set(formattedPreviewLeads.map((lead) => lead.id))
    return [
      ...formattedPreviewLeads,
      ...data.leads.filter((lead) => !previewLeadIds.has(lead.id)),
    ]
  }, [data.leads, data.workspaceSlug, previewLeads])

  const followUpLeads = useMemo(
    () =>
      dashboardLeadRecords.filter((lead) =>
        Boolean(lead.followUpDue && lead.followUpDue <= demoTaskToday),
      ),
    [dashboardLeadRecords],
  )

  const dashboardOpportunityRecords = useMemo(
    () => previewOpportunities,
    [previewOpportunities],
  )

  const openDashboardOpportunities = useMemo(
    () => selectOpenOpportunities(dashboardOpportunityRecords),
    [dashboardOpportunityRecords],
  )

  const wonDashboardOpportunities = useMemo(
    () => selectWonOpportunities(dashboardOpportunityRecords),
    [dashboardOpportunityRecords],
  )

  const dashboardRecentClients = useMemo<DashboardClientSummary[]>(() => {
    const formattedPreviewClients = previewClients.map((client) => ({
      id: client.id,
      name: client.name,
      company: client.company,
      status: client.pipelineStage,
      value: formatChartCurrency(client.value),
      health: client.health,
      openTasks: client.openTasks,
      lastActivity: formatWorkspaceCompactDate(client.lastActivity),
      nextAction: client.nextAction,
      nextStepLabel: client.nextAction,
      tags: client.tags,
    }))
    const previewClientIds = new Set(
      formattedPreviewClients.map((client) => client.id),
    )
    return [
      ...formattedPreviewClients,
      ...data.recentClients.filter((client) => {
        return !client.id || !previewClientIds.has(client.id)
      }),
    ].slice(0, 5)
  }, [data.recentClients, previewClients])

  const commerceProductCounts = useMemo(
    () => selectProductCounts(previewProducts),
    [previewProducts],
  )

  const commerceOrderCounts = useMemo(
    () => selectOrderCounts(previewOrders),
    [previewOrders],
  )

  const commerceFulfillmentCounts = useMemo(
    () => selectFulfillmentCounts(previewFulfillments),
    [previewFulfillments],
  )

  const commerceFinancialSummary = useMemo(
    () => summarizeOrderFinancials(previewOrders, previewProducts),
    [previewOrders, previewProducts],
  )

  const recentProducts = useMemo<DashboardProductSummary[]>(
    () =>
      previewProducts
        .slice()
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime(),
        )
        .slice(0, 5)
        .map((product) => ({
          id: product.id,
          name: product.name,
          status:
            product.status === 'ACTIVE'
              ? 'Active'
              : product.status === 'ARCHIVED'
                ? 'Archived'
                : 'Draft',
          price: formatProductPriceRange(product),
          inventoryState: formatInventoryState(
            getProductInventoryState(product),
          ),
          updated: formatWorkspaceCompactDate(product.updatedAt),
        })),
    [previewProducts],
  )

  const recentOrders = useMemo<DashboardOrderSummary[]>(
    () =>
      previewOrders
        .slice()
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime(),
        )
        .slice(0, 5)
        .map((order) => {
          const financials = calculateOrderFinancialsFromOrder(
            order,
            previewProducts,
          )
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            customer: getOrderCustomerLabel(order, previewCommerceCustomers),
            status:
              order.status === 'COMPLETED'
                ? 'Completed'
                : order.status === 'CANCELLED'
                  ? 'Cancelled'
                  : order.status === 'DRAFT'
                    ? 'Draft'
                    : 'Open',
            paymentStatus:
              order.paymentStatus === 'PAID'
                ? 'Paid'
                : order.paymentStatus === 'UNPAID'
                  ? 'Unpaid'
                  : 'Pending',
            fulfillmentStatus:
              order.fulfillmentStatus === 'DELIVERED'
                ? 'Delivered'
                : order.fulfillmentStatus === 'UNFULFILLED'
                  ? 'Unfulfilled'
                  : 'In progress',
            total: formatChartCurrency(financials.totalOrderRevenue),
            updated: formatWorkspaceCompactDate(order.updatedAt),
          }
        }),
    [previewCommerceCustomers, previewOrders, previewProducts],
  )

  const productStatusBreakdown = useMemo<BreakdownPoint[]>(
    () =>
      [
        { label: 'Active', value: commerceProductCounts.active },
        { label: 'Draft', value: commerceProductCounts.draft },
        { label: 'Archived', value: commerceProductCounts.archived },
      ].filter((point) => point.value > 0),
    [commerceProductCounts],
  )

  const inventoryHealthBreakdown = useMemo<BreakdownPoint[]>(() => {
    const counts = previewProducts.reduce<Record<string, number>>(
      (acc, product) => {
        const state = formatInventoryState(getProductInventoryState(product))
        acc[state] = (acc[state] ?? 0) + 1
        return acc
      },
      {},
    )
    return ['In Stock', 'Low Stock', 'Out of Stock', 'Not Tracked']
      .map((label) => ({ label, value: counts[label] ?? 0 }))
      .filter((point) => point.value > 0)
  }, [previewProducts])

  const productsByCategory = useMemo<BreakdownPoint[]>(() => {
    const counts = previewProducts.reduce<Record<string, number>>(
      (acc, product) => {
        const label = product.category ?? 'Uncategorized'
        acc[label] = (acc[label] ?? 0) + 1
        return acc
      },
      {},
    )
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((first, second) => second.value - first.value)
  }, [previewProducts])

  const commerceRecentActivity = useMemo<DashboardActivity[]>(() => {
    const productActivities = previewProducts.flatMap((product) =>
      getPreviewProductActivities(data.workspaceId, product.id).map(
        (activity) => ({
          id: activity.id,
          title: activity.title,
          description: `${product.name} · Product catalog`,
          time: formatWorkspaceCompactDate(activity.createdAt),
          startedAt: activity.createdAt,
          status: 'Info' as const,
          href: `/dashboard/${data.workspaceSlug}/products`,
          source: 'Product catalog',
        }),
      ),
    )
    const orderActivities = previewOrders.flatMap((order) =>
      getPreviewOrderActivities(data.workspaceId, order.id).map((activity) => ({
        id: activity.id,
        title: activity.title,
        description: `${order.orderNumber} · ${getOrderCustomerLabel(
          order,
          previewCommerceCustomers,
        )}`,
        time: formatWorkspaceCompactDate(activity.createdAt),
        startedAt: activity.createdAt,
        status: 'Info' as const,
        href: `/dashboard/${data.workspaceSlug}/orders`,
        source: 'Orders',
      })),
    )
    const fulfillmentActivities = previewFulfillments.flatMap((fulfillment) =>
      getPreviewFulfillmentActivities(data.workspaceId, fulfillment.id).map(
        (activity) => ({
          id: activity.id,
          title: activity.title,
          description: `${fulfillment.fulfillmentNumber} · Fulfillment`,
          time: formatWorkspaceCompactDate(activity.createdAt),
          startedAt: activity.createdAt,
          status: 'Info' as const,
          href: `/dashboard/${data.workspaceSlug}/fulfillment`,
          source: 'Fulfillment',
        }),
      ),
    )
    return [
      ...fulfillmentActivities,
      ...orderActivities,
      ...productActivities,
      ...data.recentActivity,
    ]
      .sort(
        (first, second) =>
          new Date(second.startedAt ?? second.time).getTime() -
          new Date(first.startedAt ?? first.time).getTime(),
      )
      .slice(0, 6)
  }, [
    data.recentActivity,
    data.workspaceId,
    data.workspaceSlug,
    previewCommerceCustomers,
    previewFulfillments,
    previewOrders,
    previewProducts,
  ])

  const dashboardKpis = useMemo(
    () =>
      data.kpis.map((item) => {
        if (data.commerceEnabled && item.id === 'commerceProducts') {
          return {
            ...item,
            value: commerceProductCounts.all.toString(),
            helper:
              commerceProductCounts.all > 0
                ? `${commerceProductCounts.active} active · ${commerceProductCounts.lowStock} low stock`
                : 'Add products to build your catalog.',
          }
        }

        if (data.commerceEnabled && item.id === 'commerceOrders') {
          return {
            ...item,
            value: commerceOrderCounts.all.toString(),
            helper:
              commerceOrderCounts.all > 0
                ? `${commerceOrderCounts.open} open · ${commerceOrderCounts.completed} completed`
                : 'Orders will appear as purchases are recorded.',
          }
        }

        if (data.commerceEnabled && item.id === 'commerceRevenue') {
          return {
            ...item,
            value: formatChartCurrency(commerceFinancialSummary.revenue),
            helper:
              commerceFinancialSummary.revenue > 0
                ? 'Product sales plus shipping collected, excluding tax.'
                : 'Revenue will appear as orders are recorded.',
          }
        }

        if (data.commerceEnabled && item.id === 'commerceGrossProfit') {
          return {
            ...item,
            value:
              commerceFinancialSummary.orderGrossProfit == null
                ? 'Incomplete'
                : formatChartCurrency(
                    commerceFinancialSummary.orderGrossProfit,
                  ),
            helper:
              commerceFinancialSummary.incompleteOrderCount > 0
                ? `${commerceFinancialSummary.incompleteOrderCount} orders missing cost data`
                : `${commerceFinancialSummary.orderMarginPercent ?? 0}% order margin`,
          }
        }

        if (data.commerceEnabled && item.id === 'commerceFulfillment') {
          return {
            ...item,
            value: commerceFulfillmentCounts.all.toString(),
            helper:
              commerceFulfillmentCounts.all > 0
                ? `${commerceFulfillmentCounts.waiting} waiting · ${commerceFulfillmentCounts.ready} ready to ship`
                : 'Fulfillment records appear after orders move into operations.',
          }
        }

        if (item.id === 'tasksDue') {
          const baseDueCount = Number(item.value) || 0
          const baseDuePreviewOverrideCount = data.tasksDue.filter(
            (task) =>
              task.id &&
              scopedPreviewTasks.some(
                (previewTask) => previewTask.id === task.id,
              ) &&
              task.due <= demoTaskToday,
          ).length
          return {
            ...item,
            value: Math.max(
              0,
              baseDueCount -
                baseDuePreviewOverrideCount +
                localDueOrOverdueTasks.length,
            ).toString(),
          }
        }

        if (item.id === 'newLeads') {
          return {
            ...item,
            value: dashboardLeadRecords
              .filter((lead) => lead.status === 'New')
              .length.toString(),
            trend: `${followUpLeads.length} need follow-up`,
          }
        }

        if (item.id === 'serviceRequests') {
          const urgentCount =
            getUrgentOpenServiceRequests(openServiceRequests).length
          return {
            ...item,
            value: openServiceRequests.length.toString(),
            helper: `${urgentCount} urgent`,
            tone: urgentCount > 0 ? ('rose' as const) : ('slate' as const),
          }
        }

        if (item.id === 'openOpportunities') {
          if (dashboardOpportunityRecords.length === 0) return item
          const pipelineValue = openDashboardOpportunities.reduce(
            (total, opportunity) => total + opportunity.value,
            0,
          )
          return {
            ...item,
            value: openDashboardOpportunities.length.toString(),
            helper: formatChartCurrency(pipelineValue),
          }
        }

        if (item.id === 'wonOpportunities') {
          if (dashboardOpportunityRecords.length === 0) return item
          return {
            ...item,
            value: wonDashboardOpportunities.length.toString(),
          }
        }

        return item
      }),
    [
      commerceProductCounts,
      commerceOrderCounts,
      commerceFinancialSummary,
      commerceFulfillmentCounts,
      data.commerceEnabled,
      data.kpis,
      data.tasksDue,
      dashboardOpportunityRecords.length,
      dashboardLeadRecords,
      followUpLeads.length,
      localDueOrOverdueTasks.length,
      openServiceRequests,
      openDashboardOpportunities,
      scopedPreviewTasks,
      wonDashboardOpportunities.length,
    ],
  )

  const dashboardInsights = useMemo(
    () =>
      data.aiInsights.map((insight) =>
        insight.id === 'requests'
          ? {
              ...insight,
              text: `${openServiceRequests.length} ${terminology.serviceRequestPlural.toLowerCase()} are open across the workspace.`,
              tone:
                openServiceRequests.length > 3
                  ? ('yellow' as const)
                  : ('blue' as const),
            }
          : insight.id === 'leads'
            ? {
                ...insight,
                text: `${followUpLeads.length} leads have not been followed up with and may need outreach.`,
                tone:
                  followUpLeads.length > 0
                    ? ('yellow' as const)
                    : ('green' as const),
              }
            : insight,
      ),
    [
      data.aiInsights,
      followUpLeads.length,
      openServiceRequests.length,
      terminology.serviceRequestPlural,
    ],
  )

  const automationSeries = useMemo(
    () =>
      automationRange === '7d'
        ? data.automationSeries.slice(-7)
        : groupAutomationSeriesByWeek(data.automationSeries),
    [automationRange, data.automationSeries],
  )
  const automationRangeStats = useMemo(() => {
    const success = automationSeries.reduce(
      (total, point) => total + (point.success ?? 0),
      0,
    )
    const failed = automationSeries.reduce(
      (total, point) => total + (point.failed ?? 0),
      0,
    )
    const total = success + failed
    return {
      failed,
      successRate:
        total > 0
          ? Math.round((success / total) * 100).toString()
          : data.automationHealth.successRate,
    }
  }, [automationSeries, data.automationHealth.successRate])

  const selectedRevenueInsights =
    (selectedRevenueMonth
      ? data.revenueMonthlyInsights[selectedRevenueMonth]
      : null) ?? data.revenueInsights

  const applySmartLayout = () => {
    setSmartStatus('Smart layout prepared for this workspace view.')
    window.setTimeout(() => setSmartStatus(null), 2400)
  }

  const showPreviewMessage = (message: string) => {
    setPreviewMessage(message)
    window.setTimeout(() => setPreviewMessage(null), 2600)
  }

  const openTaskHref = (task: DashboardTaskSummary) =>
    task.id
      ? `/dashboard/${data.workspaceSlug}/tasks?taskId=${encodeURIComponent(
          task.id,
        )}#tasks-workspace`
      : `/dashboard/${data.workspaceSlug}/tasks?view=due-or-overdue#tasks-workspace`

  const openClientHref = (client: DashboardClientSummary) =>
    `/dashboard/${data.workspaceSlug}/clients?${
      client.id
        ? `clientId=${encodeURIComponent(client.id)}`
        : `search=${encodeURIComponent(client.company)}`
    }#client-relationships`

  const createClientTaskHref = (client: DashboardClientSummary) =>
    `/dashboard/${data.workspaceSlug}/clients?${
      client.id
        ? `clientId=${encodeURIComponent(client.id)}&action=create-task`
        : `search=${encodeURIComponent(client.company)}&action=create-task`
    }#client-relationships`

  const latestFailedActivity = data.recentActivity.find(
    (activity) => activity.status === 'Failed',
  )

  const ordersMissingCosts = previewOrders.filter(
    (order) =>
      calculateOrderFinancialsFromOrder(order, previewProducts)
        .missingCostCount > 0,
  )
  const lowMarginOrders = previewOrders.filter((order) => {
    const financials = calculateOrderFinancialsFromOrder(order, previewProducts)
    return (
      financials.profitabilityComplete &&
      financials.orderMarginPercent != null &&
      financials.orderMarginPercent < 20
    )
  })
  const businessPaidShippingOrders = previewOrders.filter((order) => {
    const financials = calculateOrderFinancialsFromOrder(order, previewProducts)
    return order.shippingPayer === 'BUSINESS' && financials.shippingExpense > 0
  })
  const ordersMissingShippingCost = previewOrders.filter(
    (order) =>
      order.shippingPayer === 'BUSINESS' &&
      order.shippingCost == null &&
      !order.archivedAt &&
      order.status !== 'CANCELLED',
  )
  const shippingDefaultsNeedConfiguration =
    data.commerceEnabled &&
    previewCommerceSettings != null &&
    !previewCommerceSettings.shippingDefaults.method &&
    !previewCommerceSettings.shippingDefaults.carrier &&
    previewCommerceSettings.shippingDefaults.shippingCharge == null &&
    previewCommerceSettings.shippingDefaults.shippingCost == null

  const commercePriorityActions = data.commerceEnabled
    ? [
        commerceProductCounts.all === 0
          ? {
              title: 'Add your first product',
              detail:
                'Create a product record so Orders and future automations have catalog data.',
              tone: 'cyan' as const,
              cta: 'Add products',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/products`
              },
            }
          : null,
        commerceProductCounts.draft > 0
          ? {
              title: 'Review draft products',
              detail: `${commerceProductCounts.draft} product${
                commerceProductCounts.draft === 1 ? '' : 's'
              } still in Draft.`,
              tone: 'amber' as const,
              cta: 'View drafts',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/products`
              },
            }
          : null,
        commerceProductCounts.lowStock > 0
          ? {
              title: 'Review low-stock products',
              detail: `${commerceProductCounts.lowStock} product${
                commerceProductCounts.lowStock === 1 ? '' : 's'
              } at or below threshold.`,
              tone: 'rose' as const,
              cta: 'View low stock',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/products`
              },
            }
          : null,
        previewProducts.some((product) => !product.sku)
          ? {
              title: 'Add SKUs to products',
              detail:
                'SKUs make future order lines and fulfillment easier to audit.',
              tone: 'purple' as const,
              cta: 'Open catalog',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/products`
              },
            }
          : null,
        ordersMissingCosts.length > 0
          ? {
              title: 'Add missing product costs',
              detail: `${ordersMissingCosts.length} order${
                ordersMissingCosts.length === 1 ? '' : 's'
              } cannot show final profit yet.`,
              tone: 'amber' as const,
              cta: 'Review orders',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/orders`
              },
            }
          : null,
        lowMarginOrders.length > 0
          ? {
              title: 'Review low-margin orders',
              detail: `${lowMarginOrders.length} preview order${
                lowMarginOrders.length === 1 ? '' : 's'
              } below 20% margin.`,
              tone: 'rose' as const,
              cta: 'Open orders',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/orders`
              },
            }
          : null,
        businessPaidShippingOrders.length > 0
          ? {
              title: 'Track business-paid shipping',
              detail: `${businessPaidShippingOrders.length} order${
                businessPaidShippingOrders.length === 1 ? '' : 's'
              } include internal shipping expense.`,
              tone: 'cyan' as const,
              cta: 'Review shipping',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/orders`
              },
            }
          : null,
        ordersMissingShippingCost.length > 0
          ? {
              title: 'Add shipping costs',
              detail: `${ordersMissingShippingCost.length} business-paid order${
                ordersMissingShippingCost.length === 1 ? '' : 's'
              } missing actual shipping cost.`,
              tone: 'amber' as const,
              cta: 'Open orders',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/orders`
              },
            }
          : null,
        shippingDefaultsNeedConfiguration
          ? {
              title: 'Configure shipping defaults',
              detail:
                'Set default payer, carrier, charge, and cost values for new preview orders.',
              tone: 'purple' as const,
              cta: 'Open order settings',
              onClick: () => {
                window.location.href = `/dashboard/${data.workspaceSlug}/orders`
              },
            }
          : null,
      ].filter((action): action is NonNullable<typeof action> =>
        Boolean(action),
      )
    : []

  const todayPriorityActions = data.commerceEnabled
    ? commercePriorityActions.slice(0, 3)
    : [
        ...(data.attention
          ? [
              {
                title: 'Review failed automation',
                detail: `${data.attention.workflowName}: ${data.attention.issue}`,
                tone: 'rose' as const,
                cta: 'Open failed run',
                onClick: () => {
                  window.location.href = data.attention?.failureHref ?? '#'
                },
              },
            ]
          : []),
        ...tasksDue.slice(0, 2).map((task) => ({
          title: task.title,
          detail: `${task.owner} · ${task.due} · ${task.priority}`,
          tone:
            task.priority === 'Urgent' ? ('rose' as const) : ('amber' as const),
          cta: `View ${terminology.taskPlural.toLowerCase()}`,
          onClick: () => {
            window.location.href = `/dashboard/${data.workspaceSlug}/tasks?view=due-or-overdue${
              task.id ? `&taskId=${encodeURIComponent(task.id)}` : ''
            }#tasks-workspace`
          },
        })),
        ...dashboardInsights.slice(0, 1).map((insight) => ({
          title: 'Ask AI Coach to prioritize next step',
          detail: insight.text,
          tone: 'purple' as const,
          cta: 'Ask AI Coach',
          onClick: () => {
            window.location.href = `/dashboard/${data.workspaceSlug}/ai-coach?prompt=${encodeURIComponent(
              insight.text,
            )}`
          },
        })),
      ].slice(0, 3)

  const previewDrawer = preview ? (
    preview.type === 'task' ? (
      <PreviewShell
        title={preview.task.title}
        subtitle={preview.task.relatedRecord ?? 'Workspace task'}
        onClose={() => setPreview(null)}
      >
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={preview.task.priority === 'Urgent' ? 'red' : 'yellow'}
          >
            {preview.task.priority}
          </Badge>
          {preview.task.status ? (
            <Badge variant="blue">{preview.task.status}</Badge>
          ) : null}
          {preview.task.source ? (
            <Badge variant="slate">{preview.task.source}</Badge>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PreviewField label="Due Date" value={preview.task.due} />
          <PreviewField label="Owner" value={preview.task.owner} />
          <PreviewField
            label="Linked Record"
            value={preview.task.relatedRecord}
          />
          <PreviewField
            label="Recommended Next Action"
            value="Review and complete the task before the due window closes."
          />
        </div>
        {preview.task.description ? (
          <div className="border-app bg-app-surface-muted text-app-secondary rounded-xl border p-3 text-sm leading-6">
            {preview.task.description}
          </div>
        ) : null}
        {previewMessage ? (
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-100">
            {previewMessage}
          </div>
        ) : null}
        <PreviewActions>
          <Link
            href={openTaskHref(preview.task)}
            className={previewButtonClass}
          >
            Open task
          </Link>
          <button
            type="button"
            className={previewSecondaryButtonClass}
            onClick={() =>
              showPreviewMessage(
                'Task completion will connect when workspace task workflows are enabled.',
              )
            }
          >
            Complete task
          </button>
        </PreviewActions>
      </PreviewShell>
    ) : preview.type === 'client' ? (
      <PreviewShell
        title={preview.client.company}
        subtitle={preview.client.name}
        onClose={() => setPreview(null)}
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="brand">{preview.client.status}</Badge>
          {preview.client.health ? (
            <Badge variant="green">{preview.client.health}</Badge>
          ) : null}
          {preview.client.tags?.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="slate">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PreviewField label="Value" value={preview.client.value} />
          <PreviewField
            label="Open Tasks"
            value={preview.client.openTasks ?? 0}
          />
          <PreviewField
            label="Last Activity"
            value={preview.client.lastActivity}
          />
          <PreviewField
            label="Recommended Next Action"
            value={
              preview.client.nextStepLabel ??
              preview.client.nextAction ??
              'No action needed'
            }
          />
        </div>
        {previewMessage ? (
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-100">
            {previewMessage}
          </div>
        ) : null}
        <PreviewActions>
          <Link
            href={openClientHref(preview.client)}
            className={previewButtonClass}
          >
            Open full client
          </Link>
          <Link
            href={createClientTaskHref(preview.client)}
            className={previewSecondaryButtonClass}
          >
            Create task
          </Link>
        </PreviewActions>
      </PreviewShell>
    ) : preview.type === 'execution' ? (
      <PreviewShell
        title={preview.activity.workflowName ?? preview.activity.title}
        subtitle={preview.activity.description}
        onClose={() => setPreview(null)}
      >
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={
              preview.activity.status === 'Failed'
                ? 'red'
                : preview.activity.status === 'Success'
                  ? 'green'
                  : 'yellow'
            }
          >
            {preview.activity.status}
          </Badge>
          <Badge variant="slate">{preview.activity.time}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PreviewField
            label="Workflow Name"
            value={preview.activity.workflowName ?? preview.activity.title}
          />
          <PreviewField label="Run Status" value={preview.activity.status} />
          <PreviewField
            label="Started Time"
            value={preview.activity.startedAt ?? preview.activity.time}
          />
          <PreviewField label="Duration" value={preview.activity.duration} />
          <PreviewField label="Trigger" value={preview.activity.trigger} />
          <PreviewField
            label="Source"
            value={preview.activity.source ?? 'Workspace execution log'}
          />
          <PreviewField label="Step Count" value={preview.activity.steps} />
          <PreviewField
            label="Impact"
            value={
              preview.activity.status === 'Failed'
                ? 'This run may affect customer follow-up or reporting until reviewed.'
                : 'This run is part of normal workspace automation activity.'
            }
          />
          <PreviewField
            label="Recommended Action"
            value={
              preview.activity.status === 'Failed'
                ? 'Open the failed run and review logs before retrying.'
                : 'Review execution details if you need the run history.'
            }
          />
          {preview.activity.status === 'Failed' ? (
            <PreviewField
              label="Error Message"
              value={
                preview.activity.errorMessage ?? 'No detailed error captured.'
              }
            />
          ) : null}
        </div>
        {previewMessage ? (
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-100">
            {previewMessage}
          </div>
        ) : null}
        <PreviewActions>
          <Link
            href={
              preview.activity.status === 'Failed'
                ? (preview.activity.executionHref ??
                  `/dashboard/${data.workspaceSlug}/executions?view=failed&executionId=${preview.activity.id}#execution-history`)
                : `/dashboard/${data.workspaceSlug}/executions?executionId=${preview.activity.id}#execution-history`
            }
            className={previewButtonClass}
          >
            {preview.activity.status === 'Failed'
              ? 'Open failed run'
              : 'View execution'}
          </Link>
          <Link
            href={
              preview.activity.workflowHref ??
              `/dashboard/${data.workspaceSlug}/automations`
            }
            className={previewSecondaryButtonClass}
          >
            Open workflow
          </Link>
          {preview.activity.status === 'Failed' ? (
            <>
              <button
                type="button"
                className={previewSecondaryButtonClass}
                onClick={() =>
                  showPreviewMessage('Retry backend is not connected yet.')
                }
              >
                Retry run
              </button>
              <Link
                href={`/dashboard/${data.workspaceSlug}/ai-coach?prompt=${encodeURIComponent(
                  `Diagnose this workflow run: ${preview.activity.title}`,
                )}`}
                className={previewSecondaryButtonClass}
              >
                Ask AI to diagnose
              </Link>
            </>
          ) : null}
        </PreviewActions>
      </PreviewShell>
    ) : (
      <PreviewShell
        title="AI insight"
        subtitle={preview.insight.text}
        onClose={() => setPreview(null)}
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant={preview.insight.tone}>Insight</Badge>
        </div>
        {data.commerceEnabled ? (
          <div className="border-app bg-app-surface-muted text-app-secondary rounded-xl border p-3 text-sm">
            Product data is ready for future order and fulfillment workflows.
            Add details, categories, SKUs, images, and inventory tracking to
            make the catalog more useful.
          </div>
        ) : preview.insight.id === 'follow-up' ? (
          <div className="space-y-2">
            {followUpLeads.map((lead) => (
              <div
                key={lead.id}
                className="recommendation-card-surface rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-app-primary text-sm font-medium">
                      {lead.name}
                    </p>
                    <p className="text-app-muted text-xs">{lead.company}</p>
                  </div>
                  <Badge variant="yellow">{lead.status}</Badge>
                </div>
                <div className="text-app-secondary mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <span>{lead.owner}</span>
                  <span>{lead.value}</span>
                  <span>{lead.followUp}</span>
                </div>
              </div>
            ))}
          </div>
        ) : preview.insight.id === 'automation' ? (
          <div className="border-app bg-app-surface-muted text-app-secondary rounded-xl border p-3 text-sm">
            {latestFailedActivity
              ? `${latestFailedActivity.title} failed at ${latestFailedActivity.time}. Review logs before retrying.`
              : 'No failed run is currently visible in this dashboard window.'}
          </div>
        ) : (
          <div className="space-y-2">
            {openServiceRequests.map((request) => (
              <div
                key={request.id}
                className="recommendation-card-surface rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-app-primary text-sm font-medium">
                      {request.company}
                    </p>
                    <p className="text-app-muted text-xs">{request.customer}</p>
                  </div>
                  <Badge
                    variant={request.priority === 'Urgent' ? 'red' : 'yellow'}
                  >
                    {request.priority}
                  </Badge>
                </div>
                <p className="text-app-muted mt-2 text-xs">
                  {request.status} · {request.scheduled} · {request.owner}
                </p>
              </div>
            ))}
          </div>
        )}
        {previewMessage ? (
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-100">
            {previewMessage}
          </div>
        ) : null}
        <PreviewActions>
          <Link
            href={getInsightHref(data.workspaceSlug, preview.insight)}
            className={previewButtonClass}
          >
            {data.commerceEnabled
              ? 'Open catalog'
              : preview.insight.id === 'follow-up'
                ? 'View filtered leads'
                : preview.insight.id === 'automation'
                  ? 'Open failed run'
                  : 'View open requests'}
          </Link>
          {!data.commerceEnabled ? (
            <button
              type="button"
              className={previewSecondaryButtonClass}
              onClick={() =>
                showPreviewMessage(
                  preview.insight.id === 'follow-up'
                    ? 'Follow-up task creation will connect when CRM task workflows are enabled.'
                    : preview.insight.id === 'automation'
                      ? 'Retry run will connect when execution retry workflows are enabled.'
                      : 'Scheduling and assignment actions will connect when service workflows are enabled.',
                )
              }
            >
              {preview.insight.id === 'follow-up'
                ? 'Create follow-up task'
                : preview.insight.id === 'automation'
                  ? 'Retry run'
                  : 'Schedule request'}
            </button>
          ) : null}
          <Link
            href={`/dashboard/${data.workspaceSlug}/ai-coach?prompt=${encodeURIComponent(
              preview.insight.text,
            )}`}
            className={previewSecondaryButtonClass}
          >
            Ask AI Coach
          </Link>
        </PreviewActions>
      </PreviewShell>
    )
  ) : null

  return (
    <div className="space-y-5">
      <section className="app-panel relative overflow-hidden rounded-3xl p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.12),transparent_32%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="brand">Command Center</Badge>
              <Badge variant={data.dataMode === 'real' ? 'green' : 'slate'}>
                {data.dataMode === 'real'
                  ? 'Live workspace data'
                  : 'Live + preview signals'}
              </Badge>
            </div>
            <h1 className="text-app-primary text-2xl font-semibold tracking-tight sm:text-3xl">
              {data.workspaceName}
            </h1>
            <p className="text-app-secondary mt-2 text-sm leading-6">
              {data.summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCustomizeOpen((current) => !current)}
              className="border-app bg-app-surface-muted text-app-primary hover:bg-app-surface-hover inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:border-cyan-500/35 hover:text-cyan-700 dark:hover:text-cyan-100"
            >
              <LayoutDashboard className="h-4 w-4" />
              Customize dashboard
            </button>
            <button
              type="button"
              onClick={applySmartLayout}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-100"
            >
              <Sparkles className="h-4 w-4" />
              Smart layout
            </button>
            <Link
              href={`/dashboard/${data.workspaceSlug}/ai-coach`}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:bg-cyan-500/15 dark:text-cyan-100"
            >
              <Bot className="h-4 w-4" />
              Ask AI Coach
            </Link>
          </div>
        </div>
        {customizeOpen || smartStatus ? (
          <div className="border-app bg-app-surface-muted text-app-secondary relative mt-4 rounded-2xl border p-3 text-xs">
            {smartStatus ??
              'Dashboard customization is ready for workspace-specific layouts. Advanced widget presets can connect to saved preferences next.'}
          </div>
        ) : null}
      </section>

      {data.attention ? (
        <section className="bg-status-warning-surface rounded-2xl border border-amber-500/25 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="yellow">{data.attention.title}</Badge>
                <span className="text-xs text-amber-700 dark:text-amber-100/80">
                  {data.attention.time}
                </span>
              </div>
              <p className="text-app-primary mt-2 text-sm font-medium">
                {data.attention.workflowName}
              </p>
              <p className="text-app-secondary text-xs">
                {data.attention.issue}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={data.attention.failureHref}
                className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-100"
              >
                View failure
              </Link>
              <Link
                href={data.attention.workflowHref}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:bg-cyan-500/15 dark:text-cyan-100"
              >
                Open workflow
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((item) => (
          <KpiCard key={item.id ?? item.label} item={item} />
        ))}
      </section>

      <RecommendedActionsCard
        title="Today’s Priorities"
        description={
          data.commerceEnabled
            ? 'Commerce setup and catalog work Skillify would move first.'
            : `The most important work Skillify would move first across ${terminology.taskPlural.toLowerCase()}, automations, and ${terminology.customerPlural.toLowerCase()}${
                modules.sales || modules.opportunities
                  ? ', and revenue work'
                  : ''
              }.`
        }
        actions={
          todayPriorityActions.length > 0
            ? todayPriorityActions
            : [
                {
                  title: data.commerceEnabled
                    ? 'Catalog setup is on track'
                    : 'No urgent priorities detected',
                  detail: data.commerceEnabled
                    ? 'No commerce tasks need attention.'
                    : 'As records are created, Skillify will surface overdue work, failed automations, and high-impact follow-ups here.',
                  tone: 'green',
                  cta: data.commerceEnabled ? 'Open catalog' : 'View analytics',
                  onClick: () => {
                    window.location.href = data.commerceEnabled
                      ? `/dashboard/${data.workspaceSlug}/products`
                      : `/dashboard/${data.workspaceSlug}/analytics`
                  },
                },
              ]
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
        <SectionCard
          title={
            data.commerceEnabled
              ? 'Revenue / Order Performance'
              : modules.opportunities
                ? 'Revenue / Pipeline Performance'
                : modules.sales
                  ? `${terminology.salesLabel} Performance`
                  : `${terminology.customerPlural} Value`
          }
          description={
            data.commerceEnabled
              ? 'Revenue and order trends will appear as orders are created.'
              : modules.opportunities
                ? 'Won revenue and open pipeline movement across the current period.'
                : modules.sales
                  ? 'Recognized revenue and completed work across the current period.'
                  : `Value and activity across active ${terminology.customerPlural.toLowerCase()}.`
          }
          className="xl:row-span-2"
          action={
            <Link
              href={`/dashboard/${data.workspaceSlug}/reports`}
              className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-100 dark:hover:text-cyan-50"
            >
              View reports
            </Link>
          }
        >
          <RevenueChart
            data={data.revenueSeries}
            selectedLabel={selectedRevenueMonth}
            onSelect={setSelectedRevenueMonth}
          />
          <div className="text-app-muted mt-2 text-xs">
            {selectedRevenueMonth
              ? `Showing insights for ${selectedRevenueMonth}`
              : 'Select a month to review revenue signals.'}
          </div>
          {data.commerceEnabled ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  'Merchandise revenue',
                  commerceFinancialSummary.merchandiseRevenue,
                ],
                ['Shipping revenue', commerceFinancialSummary.shippingRevenue],
                [
                  'Total order revenue',
                  commerceFinancialSummary.totalOrderRevenue,
                ],
                ['COGS', commerceFinancialSummary.costOfGoodsSold],
                ['Shipping expense', commerceFinancialSummary.shippingExpense],
                [
                  'Order gross profit',
                  commerceFinancialSummary.orderGrossProfit,
                ],
                [
                  'Average order value',
                  commerceFinancialSummary.averageOrderValue,
                ],
                [
                  'Order margin',
                  commerceFinancialSummary.orderMarginPercent == null
                    ? null
                    : `${commerceFinancialSummary.orderMarginPercent}%`,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-app bg-app-surface-muted rounded-xl border px-3 py-2 text-xs"
                >
                  <p className="text-app-muted">{label}</p>
                  <p className="text-app-primary mt-1 font-semibold">
                    {typeof value === 'number'
                      ? formatChartCurrency(value)
                      : (value ?? 'Incomplete')}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {selectedRevenueInsights.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {selectedRevenueInsights.map((insight) => (
                <div
                  key={insight.label}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs',
                    toneClasses[insight.tone ?? 'slate'],
                  )}
                >
                  <p className="text-app-muted">{insight.label}</p>
                  <p className="text-app-primary mt-1 font-semibold">
                    {insight.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <DashboardEmptyState
              label={
                data.commerceEnabled
                  ? 'No order revenue yet'
                  : modules.opportunities
                    ? 'More revenue insights will appear as opportunities move through the pipeline.'
                    : `More value insights will appear as ${terminology.customerPlural.toLowerCase()} are created.`
              }
            />
          )}
        </SectionCard>

        <SectionCard
          title="Automation Health"
          description="Execution outcomes from recent workflow activity."
          href={`/dashboard/${data.workspaceSlug}/executions#execution-history`}
          action={
            <div className="flex items-center gap-2">
              <div
                className="border-app bg-app-surface-muted inline-flex rounded-full border p-0.5"
                data-prevent-card-click="true"
              >
                {(['7d', '30d'] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setAutomationRange(range)
                    }}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                      automationRange === range
                        ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-100'
                        : 'text-neutral-text-secondary hover:text-app-primary',
                    )}
                    aria-pressed={automationRange === range}
                  >
                    {range === '7d' ? '7 days' : '30 days'}
                  </button>
                ))}
              </div>
              <Link
                href={`/dashboard/${data.workspaceSlug}/executions#execution-history`}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                aria-label="Open execution success rate"
              >
                <Badge
                  variant={automationRangeStats.failed > 0 ? 'yellow' : 'green'}
                >
                  {automationRangeStats.successRate}%
                </Badge>
              </Link>
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
            <Link
              href={`/dashboard/${data.workspaceSlug}/automations#automations-workspace`}
              className="recommendation-card-surface rounded-xl border p-2 transition hover:border-cyan-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label="Open active automations"
            >
              <p className="text-app-muted">Active</p>
              <p className="text-app-primary mt-1 font-semibold">
                {data.automationHealth.activeAutomations}
              </p>
            </Link>
            <Link
              href={`/dashboard/${data.workspaceSlug}/executions?view=failed#execution-history`}
              className="recommendation-card-surface rounded-xl border p-2 transition hover:border-rose-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label="Open failed runs"
            >
              <p className="text-app-muted">Failed</p>
              <p className="text-app-primary mt-1 font-semibold">
                {automationRangeStats.failed}
              </p>
            </Link>
            <Link
              href={`/dashboard/${data.workspaceSlug}/executions?view=slow-runs#runtime-chart`}
              className="recommendation-card-surface rounded-xl border p-2 transition hover:border-violet-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label="Open slow execution runs"
            >
              <p className="text-app-muted">Avg time</p>
              <p className="text-app-primary mt-1 font-semibold">
                {data.automationHealth.avgDuration}
              </p>
            </Link>
          </div>
          <AutomationHealthChart data={automationSeries} />
        </SectionCard>

        <SectionCard
          title="AI Coach Insights"
          description="Signals Skillify would prioritize next."
          action={
            <Link
              href={`/dashboard/${data.workspaceSlug}/ai-coach`}
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-100 dark:hover:text-cyan-50"
            >
              Ask AI Coach <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="space-y-2">
            {dashboardInsights.map((insight) => (
              <button
                key={insight.id}
                type="button"
                onClick={() => setPreview({ type: 'insight', insight })}
                className="recommendation-card-surface group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                aria-label={`Preview insight ${insight.text}`}
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                <p className="text-app-primary flex-1 text-sm">
                  {insight.text}
                </p>
                <Badge variant={insight.tone}>Insight</Badge>
                <ChevronRight className="text-app-muted mt-0.5 h-4 w-4 transition group-hover:text-cyan-700 dark:group-hover:text-cyan-100" />
              </button>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Recent Activity"
          description="A connected timeline of recent runs and workspace movement."
        >
          {(data.commerceEnabled ? commerceRecentActivity : data.recentActivity)
            .length === 0 ? (
            <DashboardEmptyState label="No recent activity yet" />
          ) : (
            <div className="space-y-2">
              {(data.commerceEnabled
                ? commerceRecentActivity
                : data.recentActivity
              )
                .slice(0, 5)
                .map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={(event) => {
                      preventCardClick(event)
                      setPreview({ type: 'execution', activity })
                    }}
                    className="recommendation-card-surface group w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                    aria-label={`Preview activity ${activity.title}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-1.5 h-2.5 w-2.5 rounded-full',
                          activity.status === 'Failed'
                            ? 'bg-rose-400'
                            : activity.status === 'Success'
                              ? 'bg-emerald-400'
                              : activity.status === 'Pending'
                                ? 'bg-amber-400'
                                : 'bg-cyan-400',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-app-primary truncate text-sm font-medium">
                          {activity.title}
                        </p>
                        <p className="text-app-muted mt-1 line-clamp-2 text-xs">
                          {activity.description}
                        </p>
                        <p className="text-app-muted mt-2 text-[11px]">
                          {activity.time}
                        </p>
                      </div>
                      <ChevronRight className="text-app-muted mt-1 h-4 w-4 opacity-0 transition group-hover:text-cyan-700 group-hover:opacity-100 dark:group-hover:text-cyan-100" />
                    </div>
                  </button>
                ))}
            </div>
          )}
        </SectionCard>

        {data.commerceEnabled ? (
          <SectionCard
            title="Recent Products"
            description="Recently updated catalog records."
            href={`/dashboard/${data.workspaceSlug}/products`}
          >
            <div className="space-y-2">
              {recentProducts.length === 0 ? (
                <DashboardEmptyState label="No product data yet" />
              ) : (
                recentProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/dashboard/${data.workspaceSlug}/products`}
                    className="recommendation-card-surface group block rounded-xl border p-3 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-app-primary truncate text-sm font-medium">
                          {product.name}
                        </p>
                        <p className="text-app-muted mt-1 text-xs">
                          {product.price} · {product.inventoryState}
                        </p>
                      </div>
                      <Badge variant="slate">{product.status}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            title={
              data.taskMetricScope === 'serviceRequestChildren'
                ? `${terminology.taskPlural} Priorities`
                : 'Workspace Task Priorities'
            }
            description={
              data.taskMetricScope === 'serviceRequestChildren'
                ? `Open ${terminology.taskPlural.toLowerCase()} attached to ${terminology.serviceRequestPlural.toLowerCase()}, ordered by due date and priority.`
                : 'Workspace-wide open work, ordered by overdue, due today, priority, and upcoming due dates.'
            }
            href={`/dashboard/${data.workspaceSlug}/tasks?view=due-or-overdue#tasks-workspace`}
          >
            <div className="space-y-2">
              {tasksDue.length === 0 ? (
                <DashboardEmptyState
                  label={`No open ${terminology.taskPlural.toLowerCase()} priorities`}
                />
              ) : (
                tasksDue.slice(0, 5).map((task) => (
                  <button
                    key={`${task.title}-${task.due}`}
                    type="button"
                    onClick={(event) => {
                      preventCardClick(event)
                      setPreview({ type: 'task', task })
                    }}
                    className="recommendation-card-surface group block w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                    aria-label={`Open task ${task.title}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-app-primary text-sm font-medium">
                          {task.title}
                        </p>
                        <p className="text-app-muted mt-1 text-xs">
                          {task.owner} • {task.due}
                        </p>
                      </div>
                      <Badge
                        variant={task.priority === 'Urgent' ? 'red' : 'yellow'}
                      >
                        {task.priority}
                      </Badge>
                      <ChevronRight className="text-app-muted mt-0.5 h-4 w-4 opacity-0 transition group-hover:text-cyan-700 group-hover:opacity-100 dark:group-hover:text-cyan-100" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </SectionCard>
        )}

        {data.commerceEnabled ? (
          <SectionCard
            title="Recent Orders"
            description="Recently updated preview orders and customer purchases."
            href={`/dashboard/${data.workspaceSlug}/orders`}
          >
            <div className="space-y-2">
              {recentOrders.length === 0 ? (
                <DashboardEmptyState label="No order data yet" />
              ) : (
                recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/${data.workspaceSlug}/orders`}
                    className="recommendation-card-surface group block rounded-xl border p-3 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-app-primary truncate text-sm font-medium">
                          {order.orderNumber} · {order.customer}
                        </p>
                        <p className="text-app-muted mt-1 text-xs">
                          {order.total} · {order.paymentStatus} ·{' '}
                          {order.updated}
                        </p>
                      </div>
                      <Badge
                        variant={
                          order.status === 'Completed' ? 'green' : 'blue'
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            title={
              modules.opportunities
                ? `Recent ${terminology.customerPlural} / ${terminology.opportunityPlural}`
                : `Recent ${terminology.customerPlural}`
            }
            description={
              modules.opportunities
                ? 'Active accounts and revenue movement.'
                : `Recently active ${terminology.customerPlural.toLowerCase()} and next actions.`
            }
            href={`/dashboard/${data.workspaceSlug}/clients#client-relationships`}
          >
            <div className="space-y-2">
              {dashboardRecentClients.map((client) => (
                <button
                  key={`${client.name}-${client.company}`}
                  type="button"
                  onClick={(event) => {
                    preventCardClick(event)
                    setPreview({ type: 'client', client })
                  }}
                  className="recommendation-card-surface group block w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  aria-label={`Open client ${client.company}`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_4.75rem_minmax(7rem,11rem)_1rem] items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-app-primary truncate text-sm font-medium">
                        {client.company}
                      </p>
                      <p className="text-app-muted mt-1 truncate text-xs">
                        {client.name}
                      </p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-app-primary text-sm font-semibold">
                        {client.value}
                      </p>
                      <p className="text-app-muted truncate text-[11px]">
                        {client.status}
                      </p>
                    </div>
                    <p className="min-w-0 truncate text-[11px] text-cyan-700 dark:text-cyan-100/80">
                      Next:{' '}
                      {client.nextStepLabel ??
                        client.nextAction ??
                        'No action needed'}
                    </p>
                    <ChevronRight className="text-app-muted h-4 w-4 shrink-0 opacity-0 transition group-hover:text-cyan-700 group-hover:opacity-100 dark:group-hover:text-cyan-100" />
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {data.commerceEnabled ? (
          <>
            <SectionCard
              title="Product Status"
              description="Active, Draft, and Archived catalog records."
              href={`/dashboard/${data.workspaceSlug}/products`}
            >
              <CompactBarChart
                data={productStatusBreakdown}
                valueLabel="Products"
              />
            </SectionCard>
            <SectionCard
              title="Inventory Health"
              description="Inventory state across tracked and untracked products."
              href={`/dashboard/${data.workspaceSlug}/products`}
            >
              <DonutChart data={inventoryHealthBreakdown} />
            </SectionCard>
          </>
        ) : (
          <>
            {modules.opportunities ? (
              <SectionCard
                title={`${terminology.opportunityPlural} Stages`}
                description="Where revenue is currently positioned."
                href={`/dashboard/${data.workspaceSlug}/opportunities#opportunities-workspace`}
              >
                <CompactBarChart
                  data={data.opportunityStages}
                  valueLabel={`${terminology.opportunityPlural} value`}
                  currency
                  hrefForItem={(item) =>
                    `/dashboard/${data.workspaceSlug}/opportunities?stage=${encodeURIComponent(
                      item.label,
                    )}#opportunities-workspace`
                  }
                />
              </SectionCard>
            ) : null}
            {modules.leads ? (
              <SectionCard
                title={`${terminology.leadPlural} Sources`}
                description="Where new prospects are coming from."
                href={`/dashboard/${data.workspaceSlug}/leads#leads-workspace`}
              >
                <DonutChart
                  data={data.leadSources}
                  hrefForItem={(item) =>
                    `/dashboard/${data.workspaceSlug}/leads?source=${encodeURIComponent(
                      item.label,
                    )}#leads-workspace`
                  }
                />
              </SectionCard>
            ) : null}
            {modules.serviceRequests && isServiceBusinessDashboard ? (
              <SectionCard
                title={`${terminology.serviceRequestPlural} Analytics`}
                description={
                  jobAnalyticsView === 'type'
                    ? `${terminology.serviceRequestPlural} grouped by configured job type.`
                    : jobAnalyticsView === 'schedule'
                      ? `${terminology.serviceRequestPlural} grouped by scheduled date.`
                      : `${terminology.serviceRequestPlural} grouped by current status.`
                }
                href={`/dashboard/${data.workspaceSlug}/service-requests?view=open#request-queue`}
                action={
                  <div
                    className="border-app bg-app-surface-muted inline-flex rounded-xl border p-1"
                    aria-label={`${terminology.serviceRequestPlural} analytics view`}
                  >
                    {(
                      [
                        ['type', 'Type'],
                        ['schedule', 'Schedule'],
                        ['status', 'Status'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={jobAnalyticsView === value}
                        onClick={() => setJobAnalyticsView(value)}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
                          jobAnalyticsView === value
                            ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-100'
                            : 'text-neutral-text-secondary hover:bg-app-surface-hover hover:text-app-primary',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                <CompactBarChart
                  data={
                    jobAnalyticsView === 'type'
                      ? data.serviceTypes
                      : jobAnalyticsView === 'schedule'
                        ? data.serviceRequestSchedule
                        : data.serviceRequestStatus
                  }
                  valueLabel={terminology.serviceRequestPlural}
                />
              </SectionCard>
            ) : null}
            {modules.serviceRequests && !isServiceBusinessDashboard ? (
              <SectionCard
                title={`${terminology.serviceRequestPlural} by Type`}
                description={`Open ${terminology.serviceRequestPlural.toLowerCase()} grouped by service type.`}
                href={`/dashboard/${data.workspaceSlug}/service-requests?view=open#request-queue`}
              >
                <CompactBarChart
                  data={data.serviceTypes}
                  valueLabel={terminology.serviceRequestPlural}
                />
              </SectionCard>
            ) : null}
            {modules.tasks && !isServiceBusinessDashboard ? (
              <SectionCard
                title={`${terminology.taskPlural} by Status`}
                description={
                  data.taskMetricScope === 'serviceRequestChildren'
                    ? `${terminology.taskPlural} attached to ${terminology.serviceRequestPlural.toLowerCase()}.`
                    : 'Workspace tasks by current status.'
                }
                href={`/dashboard/${data.workspaceSlug}/tasks?view=due-or-overdue#tasks-workspace`}
              >
                <CompactBarChart
                  data={data.taskStatus}
                  valueLabel={terminology.taskPlural}
                />
              </SectionCard>
            ) : null}
          </>
        )}
      </section>
      {previewDrawer}
    </div>
  )
}

export function WorkspaceAnalyticsCharts({
  data,
}: {
  data: WorkspaceCommandCenterData
}) {
  const failedRuns = data.automationHealth.failedRuns
  const topLeadSource = data.leadSources[0]
  const topStage = data.opportunityStages[0]
  const modules = data.modules ?? {
    leads: true,
    opportunities: true,
    sales: true,
    clients: true,
    serviceRequests: true,
    tasks: true,
  }
  const terminology = data.terminology ?? {
    leadPlural: 'Leads',
    opportunityPlural: 'Opportunities',
    customerSingular: 'Client',
    customerPlural: 'Clients',
    serviceRequestPlural: 'Service Requests',
    taskPlural: 'Tasks',
    salesLabel: 'Sales',
  }
  const revenueChartTitle = data.commerceEnabled
    ? 'Commerce revenue over time'
    : modules.opportunities
      ? 'Revenue over time'
      : modules.sales
        ? `${terminology.salesLabel} over time`
        : 'Revenue over time'
  const revenueChartDescription = data.commerceEnabled
    ? 'Order revenue as commerce activity is recorded.'
    : modules.opportunities
      ? 'Closed-won revenue compared with active pipeline.'
      : 'Recognized revenue from completed work.'

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((item) => (
          <KpiCard key={item.id ?? item.label} item={item} />
        ))}
      </section>

      <RecommendedActionsCard
        title="Analytics Interpretation"
        description="What changed, why it matters, and where Skillify would focus next."
        actions={[
          {
            title:
              failedRuns > 0
                ? 'Automation reliability declined'
                : 'Automation reliability is stable',
            detail:
              failedRuns > 0
                ? `${failedRuns} failed run${failedRuns === 1 ? '' : 's'} should be reviewed before more workflows are added.`
                : 'No failed runs are visible in this workspace view.',
            tone: failedRuns > 0 ? ('rose' as const) : ('green' as const),
            cta: 'Review executions',
            onClick: () => {
              window.location.href = `/dashboard/${data.workspaceSlug}/executions`
            },
          },
          modules.opportunities
            ? {
                title: topStage
                  ? `${topStage.label} is the largest pipeline stage`
                  : 'Pipeline stage data is still forming',
                detail: topStage
                  ? 'Use stage movement to decide which deals need next-step tasks.'
                  : `${terminology.opportunityPlural} analytics will become more useful as records are created.`,
                tone: 'cyan' as const,
                cta: 'Open sales pipeline',
                onClick: () => {
                  window.location.href = `/dashboard/${data.workspaceSlug}/sales-pipeline`
                },
              }
            : null,
          modules.leads
            ? {
                title: topLeadSource
                  ? `${topLeadSource.label} is the top lead source`
                  : `${terminology.leadPlural} sources need more data`,
                detail:
                  'Compare source quality against conversion before investing more effort.',
                tone: 'purple' as const,
                cta: `Review ${terminology.leadPlural.toLowerCase()}`,
                onClick: () => {
                  window.location.href = `/dashboard/${data.workspaceSlug}/leads`
                },
              }
            : null,
        ].filter((action): action is NonNullable<typeof action> =>
          Boolean(action),
        )}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title={revenueChartTitle}
          description={revenueChartDescription}
        >
          <RevenueChart
            data={data.revenueSeries}
            showPipeline={modules.opportunities}
          />
        </SectionCard>
        {modules.opportunities ? (
          <SectionCard
            title="Pipeline value over time"
            description="Open pipeline, won revenue, and lost value signals."
          >
            <RevenueChart data={data.pipelineSeries} />
          </SectionCard>
        ) : null}
        {modules.leads ? (
          <SectionCard
            title={`${terminology.leadPlural} over time`}
            description="New lead volume by period."
          >
            <CompactBarChart
              data={data.revenueSeries.map((point) => ({
                label: point.label,
                value: point.leads ?? 0,
              }))}
              valueLabel={terminology.leadPlural}
            />
          </SectionCard>
        ) : null}
        <SectionCard
          title="Automation performance"
          description="Successful and failed executions over time."
        >
          <AutomationHealthChart data={data.automationSeries} />
        </SectionCard>
        {modules.opportunities ? (
          <SectionCard
            title={`${terminology.opportunityPlural} stages`}
            description={`Current ${terminology.opportunityPlural.toLowerCase()} value by stage.`}
          >
            <CompactBarChart
              data={data.opportunityStages}
              valueLabel="Pipeline value"
              currency
            />
          </SectionCard>
        ) : null}
        {modules.leads ? (
          <SectionCard
            title={`${terminology.leadPlural} source breakdown`}
            description="Lead acquisition mix."
          >
            <DonutChart data={data.leadSources} />
          </SectionCard>
        ) : null}
        {modules.serviceRequests ? (
          <SectionCard
            title={`${terminology.serviceRequestPlural} metrics`}
            description={`${terminology.serviceRequestPlural} by service type.`}
          >
            <CompactBarChart
              data={data.serviceTypes}
              valueLabel={terminology.serviceRequestPlural}
            />
          </SectionCard>
        ) : null}
        {modules.tasks ? (
          <SectionCard
            title={`${terminology.taskPlural} metrics`}
            description={`${terminology.taskPlural} by current status.`}
          >
            <CompactBarChart
              data={data.taskStatus}
              valueLabel={terminology.taskPlural}
            />
          </SectionCard>
        ) : null}
      </section>
    </div>
  )
}

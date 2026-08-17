'use client'

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  FileText,
  Gauge,
  GripVertical,
  LayoutGrid,
  Link2,
  Lock,
  Mail,
  PanelRight,
  RotateCcw,
  Save,
  Send,
  Share2,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  ChartCard,
  DonutBreakdown,
  HorizontalBarList,
  InsightAreaChart,
  StageRail,
  type InsightBreakdownPoint,
  type InsightSeriesPoint,
} from '@/components/dashboard/workspace-insights/WorkspaceInsightCharts'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { planAtLeast, type Plan } from '@/lib/subscriptions/features'
import type {
  AdvisorScorecard,
  AiReportRecommendation,
  BusinessHealthScore,
  EstimatedImpact,
  IndustryBenchmark,
  ReportChartMetric,
  ReportChangeEvent,
  ReportOpportunity,
  ReportPriority,
  ReportStatus,
  ReportType,
  ScheduledReport,
  WorkspaceReport,
} from '@/lib/reports/types'

type TimeRange = '7d' | '30d' | '90d'
type TypeFilter = 'all' | ReportType
type StatusFilter = 'all' | ReportStatus
type ModalType = 'generate' | 'schedule' | 'share' | null
type ShareDeliveryMethod = 'email' | 'link' | 'pdf' | 'csv'
type SharePermission = 'view' | 'download'
type ShareExpiration = 'never' | '7d' | '30d' | '90d'
type ReportSectionZone = 'full' | 'topGrid' | 'main' | 'advisor'
type ReportPresetId =
  | 'executive-overview'
  | 'operations-manager'
  | 'growth-revenue'
  | 'advisor-mode'
  | 'minimal'
  | 'full-dashboard'
type ReportPresetIcon =
  | 'gauge'
  | 'layout'
  | 'target'
  | 'sparkles'
  | 'minimal'
  | 'full'
type ReportSectionCategory =
  | 'overview'
  | 'metrics'
  | 'insights'
  | 'reports'
  | 'advisor'
type ReportSectionId =
  | 'kpi-overview'
  | 'business-health-score'
  | 'trend-cards'
  | 'report-intelligence'
  | 'quick-generate'
  | 'opportunities-detected'
  | 'ai-recommendations'
  | 'filters'
  | 'recent-reports'
  | 'scheduled-reports'
  | 'recent-changes'
  | 'industry-benchmarks'
  | 'business-advisor-scorecard'
  | 'top-priorities'
  | 'estimated-impact'
  | 'report-preview'
type ReportSectionLayout = Record<
  ReportSectionId,
  {
    visible: boolean
    collapsed: boolean
    order: number
    category: ReportSectionCategory
  }
>
type ReportLayoutSnapshot = {
  visibleIds: ReportSectionId[]
  orderIds: ReportSectionId[]
  collapsedIds: ReportSectionId[]
}
type WidgetDisplayDensity = 'comfortable' | 'compact'
type ReportPreferenceLayout = Record<string, unknown>

type ReportSectionDefinition = {
  id: ReportSectionId
  label: string
  description: string
  zone: ReportSectionZone
  category: ReportSectionCategory
  defaultVisible: boolean
  defaultCollapsed: boolean
}

type ReportSectionConfig = ReportSectionDefinition & {
  render: () => ReactNode
}
type ReportPresetDefinition = {
  id: ReportPresetId
  name: string
  description: string
  icon: ReportPresetIcon
  requiredPlan: Plan
  visibleSectionIds: ReportSectionId[]
  collapsedSectionIds: ReportSectionId[]
  orderSectionIds: ReportSectionId[]
}
type AiReportLayoutRecommendation = {
  id: string
  name: string
  sourceGoal: string
  explanation: string
  visibleSectionIds: ReportSectionId[]
  collapsedSectionIds: ReportSectionId[]
}
type AiReportLayoutRule = {
  keywords: string[]
  recommendation: Omit<AiReportLayoutRecommendation, 'sourceGoal'>
}

const reportTypeOptions: TypeFilter[] = [
  'all',
  'summary',
  'automation',
  'clients',
  'operations',
  'growth',
]

const statusOptions: StatusFilter[] = [
  'all',
  'ready',
  'scheduled',
  'draft',
  'failed',
]

const timeRangeOptions: TimeRange[] = ['7d', '30d', '90d']

const statusVariant: Record<ReportStatus, BadgeVariant> = {
  ready: 'green',
  scheduled: 'blue',
  draft: 'yellow',
  failed: 'red',
}

const typeVariant: Record<ReportType, BadgeVariant> = {
  summary: 'blue',
  automation: 'purple',
  clients: 'green',
  operations: 'yellow',
  growth: 'brand',
}

const reportSectionDefinitions: ReportSectionDefinition[] = [
  {
    id: 'kpi-overview',
    label: 'KPI Overview',
    description:
      'High-level report activity, sharing, and latest report status.',
    zone: 'full',
    category: 'overview',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'business-health-score',
    label: 'Business Health Score',
    description:
      'Overall business health based on workspace performance signals.',
    zone: 'topGrid',
    category: 'metrics',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'trend-cards',
    label: 'Trend Cards',
    description: 'Visual trends for automations, tasks, and client activity.',
    zone: 'topGrid',
    category: 'metrics',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'report-intelligence',
    label: 'Report Intelligence',
    description: 'AI-powered reporting insights and report generation status.',
    zone: 'full',
    category: 'overview',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'quick-generate',
    label: 'Quick Generate',
    description: 'Fast access to common business report templates.',
    zone: 'full',
    category: 'insights',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'opportunities-detected',
    label: 'Opportunities Detected',
    description:
      'Opportunities to improve revenue, efficiency, and customer experience.',
    zone: 'full',
    category: 'insights',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'ai-recommendations',
    label: 'AI Recommendations',
    description: 'Recommended actions based on workspace performance.',
    zone: 'full',
    category: 'insights',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'filters',
    label: 'Filters',
    description: 'Controls for narrowing report history and search results.',
    zone: 'full',
    category: 'reports',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'recent-reports',
    label: 'Recent Reports',
    description:
      'Generated report history, sharing status, and export actions.',
    zone: 'main',
    category: 'reports',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'scheduled-reports',
    label: 'Scheduled Reports',
    description: 'Recurring report schedules and delivery settings.',
    zone: 'main',
    category: 'reports',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'recent-changes',
    label: 'Recent Changes',
    description:
      'Recent activity that may affect reporting and recommendations.',
    zone: 'main',
    category: 'insights',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'industry-benchmarks',
    label: 'Industry Benchmarks',
    description: 'Compare workspace performance against business benchmarks.',
    zone: 'main',
    category: 'metrics',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'business-advisor-scorecard',
    label: 'Business Advisor Scorecard',
    description:
      'Executive summary of business strengths, risks, and opportunities.',
    zone: 'advisor',
    category: 'advisor',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'top-priorities',
    label: 'Top Priorities This Week',
    description: 'The highest-impact actions to focus on this week.',
    zone: 'advisor',
    category: 'advisor',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'estimated-impact',
    label: 'Estimated Impact',
    description:
      'Estimated time savings, lead recovery, and review opportunities.',
    zone: 'advisor',
    category: 'advisor',
    defaultVisible: true,
    defaultCollapsed: false,
  },
  {
    id: 'report-preview',
    label: 'Report Preview',
    description: 'Preview the selected report and AI-generated insights.',
    zone: 'advisor',
    category: 'advisor',
    defaultVisible: true,
    defaultCollapsed: false,
  },
]

const allReportSectionIds = reportSectionDefinitions.map(
  (section) => section.id,
) as ReportSectionId[]

const reportPresetDefinitions: ReportPresetDefinition[] = [
  {
    id: 'executive-overview',
    name: 'Executive Overview',
    description:
      'High-level business visibility for owners and decision makers.',
    icon: 'gauge',
    requiredPlan: 'Free',
    visibleSectionIds: [
      'kpi-overview',
      'business-health-score',
      'ai-recommendations',
      'top-priorities',
      'recent-reports',
    ],
    collapsedSectionIds: ['recent-reports'],
    orderSectionIds: [
      'kpi-overview',
      'business-health-score',
      'ai-recommendations',
      'top-priorities',
      'recent-reports',
    ],
  },
  {
    id: 'operations-manager',
    name: 'Operations Manager',
    description:
      'Focus on daily activity, team execution, and reporting operations.',
    icon: 'layout',
    requiredPlan: 'Free',
    visibleSectionIds: [
      'kpi-overview',
      'trend-cards',
      'recent-changes',
      'filters',
      'recent-reports',
      'scheduled-reports',
      'report-preview',
    ],
    collapsedSectionIds: ['report-preview'],
    orderSectionIds: [
      'kpi-overview',
      'trend-cards',
      'recent-changes',
      'filters',
      'recent-reports',
      'scheduled-reports',
      'report-preview',
    ],
  },
  {
    id: 'growth-revenue',
    name: 'Growth & Revenue',
    description:
      'Spot opportunities, risks, benchmarks, and revenue-impacting work.',
    icon: 'target',
    requiredPlan: 'Pro',
    visibleSectionIds: [
      'kpi-overview',
      'opportunities-detected',
      'ai-recommendations',
      'industry-benchmarks',
      'estimated-impact',
      'report-preview',
    ],
    collapsedSectionIds: ['report-preview'],
    orderSectionIds: [
      'kpi-overview',
      'opportunities-detected',
      'ai-recommendations',
      'industry-benchmarks',
      'estimated-impact',
      'report-preview',
    ],
  },
  {
    id: 'advisor-mode',
    name: 'Advisor Mode',
    description:
      'AI-powered business advisor view for strategy, priorities, and next actions.',
    icon: 'sparkles',
    requiredPlan: 'Elite',
    visibleSectionIds: [
      'business-advisor-scorecard',
      'top-priorities',
      'estimated-impact',
      'ai-recommendations',
      'opportunities-detected',
      'report-preview',
    ],
    collapsedSectionIds: [],
    orderSectionIds: [
      'business-advisor-scorecard',
      'top-priorities',
      'estimated-impact',
      'ai-recommendations',
      'opportunities-detected',
      'report-preview',
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple view focused only on essential report status.',
    icon: 'minimal',
    requiredPlan: 'Free',
    visibleSectionIds: [
      'kpi-overview',
      'business-health-score',
      'recent-reports',
    ],
    collapsedSectionIds: ['recent-reports'],
    orderSectionIds: [
      'kpi-overview',
      'business-health-score',
      'recent-reports',
    ],
  },
  {
    id: 'full-dashboard',
    name: 'Full Dashboard',
    description: 'Show every available report widget.',
    icon: 'full',
    requiredPlan: 'Free',
    visibleSectionIds: allReportSectionIds,
    collapsedSectionIds: [],
    orderSectionIds: allReportSectionIds,
  },
]

const reportAiLayoutRules: AiReportLayoutRule[] = [
  {
    keywords: ['lead', 'missed call', 'follow up', 'response'],
    recommendation: {
      id: 'lead-recovery',
      name: 'Lead Recovery Layout',
      explanation:
        'Prioritizes missed leads, follow-up opportunities, and actionable recommendations to help recover revenue.',
      visibleSectionIds: [
        'kpi-overview',
        'opportunities-detected',
        'ai-recommendations',
        'top-priorities',
        'recent-reports',
        'report-preview',
      ],
      collapsedSectionIds: ['recent-reports', 'report-preview'],
    },
  },
  {
    keywords: ['review', 'reputation', 'testimonial'],
    recommendation: {
      id: 'review-growth',
      name: 'Review Growth Layout',
      explanation:
        'Focuses on completed work, review opportunities, reputation growth, and next actions.',
      visibleSectionIds: [
        'business-health-score',
        'opportunities-detected',
        'ai-recommendations',
        'estimated-impact',
        'top-priorities',
        'report-preview',
      ],
      collapsedSectionIds: ['report-preview'],
    },
  },
  {
    keywords: ['automation', 'failure', 'workflow', 'execution'],
    recommendation: {
      id: 'automation-health',
      name: 'Automation Health Layout',
      explanation:
        'Highlights automation performance, failures, recent activity, and the reports needed to troubleshoot workflows.',
      visibleSectionIds: [
        'kpi-overview',
        'trend-cards',
        'recent-changes',
        'filters',
        'recent-reports',
        'ai-recommendations',
        'report-preview',
      ],
      collapsedSectionIds: ['report-preview'],
    },
  },
  {
    keywords: ['team', 'tasks', 'operations', 'performance'],
    recommendation: {
      id: 'operations-focus',
      name: 'Operations Focus Layout',
      explanation:
        'Surfaces team activity, task progress, benchmarks, and recent changes so operations stay on track.',
      visibleSectionIds: [
        'kpi-overview',
        'trend-cards',
        'recent-changes',
        'industry-benchmarks',
        'top-priorities',
        'recent-reports',
      ],
      collapsedSectionIds: ['recent-reports'],
    },
  },
]

const fallbackAiReportLayout: Omit<AiReportLayoutRecommendation, 'sourceGoal'> =
  {
    id: 'business-advisor',
    name: 'Business Advisor Layout',
    explanation:
      'Builds a strategic advisor view with priorities, opportunities, estimated impact, and AI recommendations.',
    visibleSectionIds: [
      'business-advisor-scorecard',
      'ai-recommendations',
      'opportunities-detected',
      'top-priorities',
      'estimated-impact',
      'report-preview',
    ],
    collapsedSectionIds: ['report-preview'],
  }

function createDefaultReportSectionLayout(): ReportSectionLayout {
  return reportSectionDefinitions.reduce((layout, section, index) => {
    layout[section.id] = {
      visible: section.defaultVisible,
      collapsed: section.defaultCollapsed,
      order: index + 1,
      category: section.category,
    }
    return layout
  }, {} as ReportSectionLayout)
}

function normalizeReportSectionLayout(value: unknown): ReportSectionLayout {
  const defaults = createDefaultReportSectionLayout()
  if (!isRecord(value)) return defaults

  for (const section of reportSectionDefinitions) {
    const stored = value[section.id]
    if (!isRecord(stored)) continue

    defaults[section.id] = {
      visible:
        typeof stored.visible === 'boolean'
          ? stored.visible
          : defaults[section.id].visible,
      collapsed:
        typeof stored.collapsed === 'boolean'
          ? stored.collapsed
          : defaults[section.id].collapsed,
      order:
        typeof stored.order === 'number'
          ? stored.order
          : defaults[section.id].order,
      category:
        typeof stored.category === 'string' &&
        isReportSectionCategory(stored.category)
          ? stored.category
          : section.category,
    }
  }

  return defaults
}

function createPresetReportSectionLayout(
  preset: ReportPresetDefinition,
): ReportSectionLayout {
  const defaults = createDefaultReportSectionLayout()
  const visibleIds = new Set(preset.visibleSectionIds)
  const collapsedIds = new Set(preset.collapsedSectionIds)
  const orderedIds = [
    ...preset.orderSectionIds.filter((id) => visibleIds.has(id)),
    ...allReportSectionIds.filter((id) => !visibleIds.has(id)),
  ]

  orderedIds.forEach((id, index) => {
    defaults[id] = {
      ...defaults[id],
      visible: visibleIds.has(id),
      collapsed: collapsedIds.has(id),
      order: index + 1,
    }
  })

  return defaults
}

function generateAiReportLayoutRecommendation(
  goal: string,
): AiReportLayoutRecommendation {
  const normalizedGoal = goal.trim()
  const normalizedSearch = normalizedGoal.toLowerCase()
  const matchedRule = reportAiLayoutRules.find((rule) =>
    rule.keywords.some((keyword) => normalizedSearch.includes(keyword)),
  )
  const recommendation = matchedRule?.recommendation ?? fallbackAiReportLayout

  return {
    ...recommendation,
    sourceGoal: normalizedGoal,
  }
}

function createAiGeneratedReportSectionLayout(
  recommendation: AiReportLayoutRecommendation,
): ReportSectionLayout {
  const defaults = createDefaultReportSectionLayout()
  const visibleIds = new Set(recommendation.visibleSectionIds)
  const collapsedIds = new Set(recommendation.collapsedSectionIds)
  const orderedIds = [
    ...recommendation.visibleSectionIds,
    ...allReportSectionIds.filter((id) => !visibleIds.has(id)),
  ]

  orderedIds.forEach((id, index) => {
    defaults[id] = {
      ...defaults[id],
      visible: visibleIds.has(id),
      collapsed: collapsedIds.has(id),
      order: index + 1,
    }
  })

  return defaults
}

function getVisibleOrderedReportSectionIds(layout: ReportSectionLayout) {
  return [...allReportSectionIds]
    .sort((firstId, secondId) => {
      const firstOrder = layout[firstId]?.order ?? Number.MAX_SAFE_INTEGER
      const secondOrder = layout[secondId]?.order ?? Number.MAX_SAFE_INTEGER

      return firstOrder - secondOrder
    })
    .filter((id) => layout[id]?.visible)
}

function createReportLayoutSnapshot(
  layout: ReportSectionLayout,
): ReportLayoutSnapshot {
  const orderIds = getVisibleOrderedReportSectionIds(layout)

  return {
    visibleIds: allReportSectionIds.filter((id) => layout[id]?.visible),
    orderIds,
    collapsedIds: orderIds.filter((id) => Boolean(layout[id]?.collapsed)),
  }
}

function createPresetReportLayoutSnapshot(
  preset: ReportPresetDefinition,
): ReportLayoutSnapshot {
  const visibleIds = allReportSectionIds.filter((id) =>
    preset.visibleSectionIds.includes(id),
  )
  const visibleIdSet = new Set(visibleIds)
  const collapsedIdSet = new Set(preset.collapsedSectionIds)
  const orderIds = preset.orderSectionIds.filter((id) => visibleIdSet.has(id))

  return {
    visibleIds,
    orderIds,
    collapsedIds: orderIds.filter((id) => collapsedIdSet.has(id)),
  }
}

function arraysMatch<T>(first: T[], second: T[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  )
}

function unorderedArraysMatch<T>(first: T[], second: T[]) {
  return (
    first.length === second.length &&
    first.every((value) => second.includes(value))
  )
}

function reportLayoutSnapshotsMatch(
  current: ReportLayoutSnapshot,
  preset: ReportLayoutSnapshot,
) {
  // Preset identity is based on the dashboard users can see: exact visible
  // widgets, exact visible order, and collapsed state for those visible widgets.
  // Hidden widget order/collapsed state is intentionally ignored so hidden
  // drawer housekeeping does not make a saved preset look custom.
  return (
    unorderedArraysMatch(current.visibleIds, preset.visibleIds) &&
    arraysMatch(current.orderIds, preset.orderIds) &&
    arraysMatch(current.collapsedIds, preset.collapsedIds)
  )
}

function getActiveReportPresetId(
  layout: ReportSectionLayout,
): ReportPresetId | null {
  const currentSnapshot = createReportLayoutSnapshot(layout)
  const activePreset = reportPresetDefinitions.find((preset) =>
    reportLayoutSnapshotsMatch(
      currentSnapshot,
      createPresetReportLayoutSnapshot(preset),
    ),
  )

  return activePreset?.id ?? null
}

function getReportPresetUpgradeMessage(preset: ReportPresetDefinition) {
  if (preset.requiredPlan === 'Elite') {
    return `${preset.name} is available on Elite.`
  }

  if (preset.requiredPlan === 'Pro') {
    return `${preset.name} is available on Pro and Elite.`
  }

  return `${preset.name} is available on all plans.`
}

function getReportPresetIcon(icon: ReportPresetIcon) {
  switch (icon) {
    case 'gauge':
      return Gauge
    case 'layout':
      return LayoutGrid
    case 'target':
      return Target
    case 'sparkles':
      return Sparkles
    case 'minimal':
      return FileText
    case 'full':
      return Crown
  }
}

const reportTypes: Array<{
  title: string
  description: string
  type: ReportType
  frequency: string
}> = [
  {
    title: 'Weekly Business Summary',
    description:
      'Review completed work, failed automations, tasks, and key activity.',
    type: 'summary',
    frequency: 'Weekly',
  },
  {
    title: 'Automation Performance Report',
    description:
      'See workflow success rates, failed runs, execution trends, and bottlenecks.',
    type: 'automation',
    frequency: 'Weekly',
  },
  {
    title: 'Client Activity Report',
    description:
      'Summarize client updates, follow-ups, tasks, and communication activity.',
    type: 'clients',
    frequency: 'Monthly',
  },
  {
    title: 'Task & Operations Report',
    description:
      'Review completed tasks, overdue work, team assignments, and operational progress.',
    type: 'operations',
    frequency: 'Weekly',
  },
  {
    title: 'Growth & Insights Report',
    description:
      'Track performance trends, opportunities, and AI-generated recommendations.',
    type: 'growth',
    frequency: 'Monthly',
  },
]

const businessHealthScore: BusinessHealthScore = {
  score: 87,
  maxScore: 100,
  status: 'Stable',
  helper:
    'Based on automation health, overdue tasks, client activity, and reporting signals.',
  signals: ['80% automation success', '3 overdue tasks', '12 client updates'],
}

const chartMetrics: ReportChartMetric[] = [
  {
    id: 'automation-trend',
    title: 'Automation Trend',
    description: 'Runs over the last 30 days',
    type: 'bars',
    values: [32, 38, 42, 48, 44, 52, 58],
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
  },
  {
    id: 'task-completion',
    title: 'Task Completion',
    description: 'Completed vs overdue work',
    type: 'comparison',
    values: [76, 24],
    labels: ['Completed', 'Overdue'],
  },
  {
    id: 'client-activity',
    title: 'Client Activity',
    description: 'New clients, follow-ups, and completed work',
    type: 'grouped',
    values: [8, 14, 11],
    labels: ['New', 'Follow-ups', 'Completed'],
  },
]

const reportCenterTrend: InsightSeriesPoint[] = [
  { label: 'W1', value: 3, secondary: 5 },
  { label: 'W2', value: 5, secondary: 7 },
  { label: 'W3', value: 7, secondary: 9 },
  { label: 'W4', value: 8, secondary: 11 },
  { label: 'W5', value: 11, secondary: 14 },
  { label: 'W6', value: 12, secondary: 16 },
  { label: 'W7', value: 15, secondary: 18 },
]

const reportSnapshotBreakdown: InsightBreakdownPoint[] = [
  { label: 'Summary', value: 8, color: '#22d3ee' },
  { label: 'Automation', value: 6, color: '#8b5cf6' },
  { label: 'Clients', value: 5, color: '#34d399' },
  { label: 'Operations', value: 4, color: '#f59e0b' },
  { label: 'Growth', value: 3, color: '#60a5fa' },
]

const savedReportSignals: InsightBreakdownPoint[] = [
  {
    label: 'Weekly Business Summary',
    value: 12,
    helper: 'Most shared report',
    color: '#22d3ee',
  },
  {
    label: 'Automation Performance',
    value: 9,
    helper: 'Used for workflow reviews',
    color: '#8b5cf6',
  },
  {
    label: 'Client Activity',
    value: 7,
    helper: 'Supports account follow-up',
    color: '#34d399',
  },
]

const reportCenterStages = [
  {
    label: 'Generate',
    value: '15',
    helper: 'Snapshots created',
    active: true,
    tone: 'cyan' as const,
  },
  {
    label: 'Review',
    value: '8',
    helper: 'Advisor insights',
    active: true,
    tone: 'purple' as const,
  },
  {
    label: 'Share',
    value: '6',
    helper: 'Stakeholder sends',
    active: true,
    tone: 'green' as const,
  },
  {
    label: 'Act',
    value: '4',
    helper: 'Next steps queued',
    active: true,
    tone: 'amber' as const,
  },
]

const opportunities: ReportOpportunity[] = [
  {
    id: 'review-requests',
    type: 'revenue',
    title: 'Review requests not sent',
    body: '14 completed jobs have not received review requests.',
    impact: 'Potential action: Enable Review Request Automation.',
    cta: 'Create workflow',
  },
  {
    id: 'lead-follow-up',
    type: 'risk',
    title: 'Leads need follow-up',
    body: '3 leads have not been contacted in 48 hours.',
    impact: 'Potential revenue at risk.',
    cta: 'View recommendation',
  },
  {
    id: 'manual-follow-up',
    type: 'efficiency',
    title: 'Manual work detected',
    body: 'Recurring follow-up tasks may be taking more time than necessary.',
    impact: 'Potential action: Create an automated follow-up workflow.',
    cta: 'Create workflow',
  },
]

const advisorPrompts = [
  'What should I prioritize this week?',
  'Why did performance change?',
  'Where are the bottlenecks?',
  'What should I automate next?',
]

const topPriorities: ReportPriority[] = [
  {
    id: 'review-failed-lead-workflow',
    title: 'Review failed lead workflow',
    impact: 'high',
    impactNote: 'Recover 2 missed leads',
    action: { label: 'Open Workflow', kind: 'workflow' },
  },
  {
    id: 'contact-overdue-leads',
    title: 'Contact overdue leads',
    impact: 'high',
    impactNote: 'Reduce response delay',
    action: { label: 'View Task', kind: 'task' },
  },
  {
    id: 'send-review-requests',
    title: 'Send review requests',
    impact: 'medium',
    impactNote: '14 review opportunities',
    action: { label: 'Create Workflow', kind: 'workflow' },
  },
  {
    id: 'ask-ai-for-automation',
    title: 'Identify the next automation opportunity',
    impact: 'medium',
    impactNote: 'Save operational time',
    action: { label: 'Ask AI Coach', kind: 'ai-coach' },
  },
]

const estimatedImpact: EstimatedImpact[] = [
  {
    id: 'save-time',
    value: '3 hrs saved',
    label: 'Estimated weekly time savings',
    accent: 'green',
  },
  {
    id: 'recover-leads',
    value: '2 leads recovered',
    label: 'Potential follow-up recovery',
    accent: 'blue',
  },
  {
    id: 'increase-reviews',
    value: '14 review opportunities',
    label: 'Available from completed work',
    accent: 'green',
  },
]

const advisorScorecard: AdvisorScorecard = {
  grade: 'A-',
  status: 'Strong foundation',
  score: 87,
  maxScore: 100,
  strengths: [
    { id: 'automation-adoption', label: 'Automation adoption' },
    { id: 'client-activity', label: 'Client activity' },
    { id: 'task-completion-rate', label: 'Task completion rate' },
  ],
  risks: [
    { id: 'slow-lead-response', label: 'Slow lead response' },
    { id: 'overdue-follow-ups', label: 'Overdue follow-ups' },
    { id: 'failed-lead-workflow', label: 'Failed lead workflow' },
  ],
  opportunities: [
    { id: 'review-request-automation', label: 'Review request automation' },
    { id: 'missed-call-follow-up', label: 'Missed-call follow-up' },
    { id: 'weekly-priority-review', label: 'Weekly priority review' },
  ],
  summary:
    'Your workspace has a strong foundation, but response speed and follow-up consistency are the highest-impact areas to improve this week.',
}

const aiRecommendations: AiReportRecommendation[] = [
  {
    id: 'create-review-request-workflow',
    title: 'Create a review request workflow',
    explanation:
      'Completed client work is not consistently followed by review requests.',
    action: { label: 'Create Workflow', kind: 'workflow' },
  },
  {
    id: 'open-lead-follow-up',
    title: 'Audit the lead follow-up automation',
    explanation:
      'One failed run suggests the workflow needs better contact validation.',
    action: { label: 'Open Automation', kind: 'automation' },
  },
  {
    id: 'weekly-priority-review',
    title: 'Run a weekly priority review',
    explanation:
      'Overdue tasks and missed leads should be reviewed before next week starts.',
    action: { label: 'Ask AI Coach', kind: 'ai-coach' },
  },
  {
    id: 'automate-follow-up-tasks',
    title: 'Automate recurring follow-up tasks',
    explanation:
      'Repeated manual follow-up work is a strong candidate for automation.',
    action: { label: 'Create Workflow', kind: 'workflow' },
  },
]

const recentChanges: ReportChangeEvent[] = [
  {
    id: 'today-failed-automation',
    when: 'Today',
    title: 'Automation failed',
    kind: 'warning',
  },
  {
    id: 'yesterday-clients',
    when: 'Yesterday',
    title: '3 clients added',
    kind: 'clients',
  },
  {
    id: 'two-days-report',
    when: '2 days ago',
    title: 'Weekly report generated',
    kind: 'report',
  },
  {
    id: 'three-days-tasks',
    when: '3 days ago',
    title: '14 tasks completed',
    kind: 'completed',
  },
]

const industryBenchmarks: IndustryBenchmark[] = [
  {
    id: 'review-request-rate',
    metric: 'Review Request Rate',
    yourValue: '62%',
    industryAverage: '48%',
    status: 'ahead',
  },
  {
    id: 'lead-response-time',
    metric: 'Lead Response Time',
    yourValue: '9 hrs',
    industryAverage: '4 hrs',
    status: 'behind',
  },
  {
    id: 'task-completion-rate',
    metric: 'Task Completion Rate',
    yourValue: '76%',
    industryAverage: '72%',
    status: 'watch',
  },
  {
    id: 'client-follow-up-consistency',
    metric: 'Client Follow-up Consistency',
    yourValue: '81%',
    industryAverage: '68%',
    status: 'ahead',
  },
  {
    id: 'automation-reliability',
    metric: 'Automation Reliability',
    yourValue: '80%',
    industryAverage: '84%',
    status: 'watch',
  },
]

export function ReportsClient({
  reports,
  scheduledReports,
  workspaceId,
  workspaceSlug,
  workspacePlan,
  hasRealReports,
}: {
  reports: WorkspaceReport[]
  scheduledReports: ScheduledReport[]
  workspaceId: string
  workspaceSlug: string
  workspacePlan: Plan
  hasRealReports: boolean
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<WorkspaceReport | null>(
    reports[0] ?? null,
  )
  const [modalType, setModalType] = useState<ModalType>(null)
  const [modalMessage, setModalMessage] = useState<string | null>(null)
  const [defaultReportType, setDefaultReportType] =
    useState<ReportType>('summary')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [sectionLayout, setSectionLayout] = useState<ReportSectionLayout>(() =>
    createDefaultReportSectionLayout(),
  )
  const [savedSectionLayout, setSavedSectionLayout] =
    useState<ReportSectionLayout>(() => createDefaultReportSectionLayout())
  const [preferenceLayout, setPreferenceLayout] =
    useState<ReportPreferenceLayout>({})
  const [savingLayout, setSavingLayout] = useState(false)
  const activePresetId = useMemo(
    () => getActiveReportPresetId(sectionLayout),
    [sectionLayout],
  )

  useEffect(() => {
    let active = true

    async function loadReportLayout() {
      try {
        const response = await fetch(
          `/api/dashboard/preferences?workspaceId=${encodeURIComponent(workspaceId)}`,
        )
        if (!response.ok) return

        const data = (await response.json()) as { layout?: unknown }
        if (!active || !isRecord(data.layout)) return

        setPreferenceLayout(data.layout)
        const loadedLayout = normalizeReportSectionLayout(
          data.layout.reportsDashboard,
        )
        setSectionLayout(loadedLayout)
        setSavedSectionLayout(loadedLayout)
      } catch {
        // Keep default local layout if preferences cannot be loaded.
      }
    }

    void loadReportLayout()

    return () => {
      active = false
    }
  }, [workspaceId])

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()
    const now = Date.now()
    const rangeMs =
      timeRange === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : timeRange === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : 90 * 24 * 60 * 60 * 1000

    return reports.filter((report) => {
      const generatedAt = report.generatedAt
        ? new Date(report.generatedAt).getTime()
        : null

      if (typeFilter !== 'all' && report.type !== typeFilter) return false
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      if (generatedAt && now - generatedAt > rangeMs && !report.isMock) {
        return false
      }
      if (
        query &&
        !report.title.toLowerCase().includes(query) &&
        !report.createdBy.toLowerCase().includes(query)
      ) {
        return false
      }

      return true
    })
  }, [reports, search, statusFilter, timeRange, typeFilter])

  const overview = useMemo(() => {
    const generated = reports.filter((report) => report.status === 'ready')
    const shared = reports.filter((report) => report.shared)
    const lastGenerated = generated
      .map((report) => report.generatedAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

    return [
      {
        label: 'Reports generated',
        value: generated.length.toString(),
        helper: hasRealReports ? 'Workspace reports' : 'Preview dataset',
      },
      {
        label: 'Scheduled reports',
        value: scheduledReports.length.toString(),
        helper: 'Recurring delivery',
      },
      {
        label: 'Shared reports',
        value: shared.length.toString(),
        helper: 'Sent or shared',
      },
      {
        label: 'Last generated',
        value: lastGenerated ? formatRelativeDate(lastGenerated) : '-',
        helper: 'Most recent report',
      },
    ]
  }, [hasRealReports, reports, scheduledReports.length])
  const hasUnsavedLayoutChanges =
    JSON.stringify(sectionLayout) !== JSON.stringify(savedSectionLayout)

  const resetFilters = () => {
    setTypeFilter('all')
    setStatusFilter('all')
    setTimeRange('30d')
    setSearch('')
  }

  const openGenerateModal = (reportType: ReportType = 'summary') => {
    setDefaultReportType(reportType)
    setModalMessage(null)
    setModalType('generate')
  }

  const openScheduleModal = () => {
    setModalMessage(null)
    setModalType('schedule')
  }

  const openShareModal = () => {
    setModalMessage(null)
    setModalType('share')
  }

  const showPlaceholderMessage = (message: string) => {
    setModalMessage(message)
  }

  const openCustomizeDrawer = () => {
    setSectionLayout(savedSectionLayout)
    setCustomizeOpen(true)
  }

  const closeCustomizeDrawer = () => {
    setSectionLayout(savedSectionLayout)
    setCustomizeOpen(false)
  }

  const resetReportLayout = () => {
    setSectionLayout(createDefaultReportSectionLayout())
    setModalMessage('Reports dashboard layout reset to defaults.')
  }

  const persistReportLayout = async (
    nextLayout: ReportSectionLayout,
    successMessage: string | null,
    failureMessage: string,
  ) => {
    const nextPreferenceLayout = {
      ...preferenceLayout,
      reportsDashboard: nextLayout,
    }

    setSavingLayout(true)
    setSectionLayout(nextLayout)
    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          layout: nextPreferenceLayout,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save reports dashboard layout')
      }

      setPreferenceLayout(nextPreferenceLayout)
      setSavedSectionLayout(nextLayout)
      if (successMessage) {
        setModalMessage(successMessage)
      }
      return true
    } catch {
      setModalMessage(failureMessage)
      return false
    } finally {
      setSavingLayout(false)
    }
  }

  const applyReportPreset = async (presetId: ReportPresetId) => {
    const preset = reportPresetDefinitions.find(
      (candidate) => candidate.id === presetId,
    )
    if (!preset) return false

    return persistReportLayout(
      createPresetReportSectionLayout(preset),
      null,
      `${preset.name} preset could not be saved. Your changes remain local for now.`,
    )
  }

  const applyAiReportLayout = async (
    recommendation: AiReportLayoutRecommendation,
  ) => {
    return persistReportLayout(
      createAiGeneratedReportSectionLayout(recommendation),
      null,
      `${recommendation.name} could not be saved. Your changes remain local for now.`,
    )
  }

  const saveReportLayout = async () => {
    await persistReportLayout(
      sectionLayout,
      'Reports dashboard layout saved.',
      'Reports dashboard layout could not be saved. Your changes remain local for now.',
    )
  }

  const setSectionVisibility = (id: ReportSectionId, visible: boolean) => {
    setSectionLayout((current) => ({
      ...current,
      [id]: {
        ...current[id],
        visible,
      },
    }))
  }

  const setAllSectionsVisible = (visible: boolean) => {
    setSectionLayout((current) => {
      const next = { ...current }

      reportSectionDefinitions.forEach((section) => {
        next[section.id] = {
          ...next[section.id],
          visible: visible || section.id === 'kpi-overview',
        }
      })

      return next
    })
  }

  const setSectionCollapsed = (id: ReportSectionId, collapsed: boolean) => {
    setSectionLayout((current) => ({
      ...current,
      [id]: {
        ...current[id],
        collapsed,
      },
    }))
  }

  const moveReportSection = (id: ReportSectionId, direction: -1 | 1) => {
    setSectionLayout((current) => {
      const orderedIds = getOrderedReportSections(
        reportSectionDefinitions,
        current,
      ).map((section) => section.id)
      const currentIndex = orderedIds.indexOf(id)
      const targetIndex = currentIndex + direction

      if (
        currentIndex === -1 ||
        targetIndex < 0 ||
        targetIndex >= orderedIds.length
      ) {
        return current
      }

      const reordered = [...orderedIds]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      const next = { ...current }
      reordered.forEach((sectionId, index) => {
        next[sectionId] = {
          ...next[sectionId],
          order: index + 1,
        }
      })

      return next
    })
  }

  const reorderReportSections = (
    activeId: ReportSectionId,
    overId: ReportSectionId,
  ) => {
    if (activeId === overId) return

    setSectionLayout((current) => {
      const orderedIds = getOrderedReportSections(
        reportSectionDefinitions,
        current,
      ).map((section) => section.id)
      const oldIndex = orderedIds.indexOf(activeId)
      const newIndex = orderedIds.indexOf(overId)

      if (oldIndex === -1 || newIndex === -1) return current

      const reordered = arrayMove(orderedIds, oldIndex, newIndex)
      const next = { ...current }

      reordered.forEach((sectionId, index) => {
        next[sectionId] = {
          ...next[sectionId],
          order: index + 1,
        }
      })

      return next
    })
  }

  const renderReportSection = (section: ReportSectionConfig) => {
    const layout = sectionLayout[section.id]
    if (!layout?.visible) return null

    if (layout.collapsed) {
      return (
        <CollapsedReportSection
          key={section.id}
          section={section}
          onExpand={() => setSectionCollapsed(section.id, false)}
        />
      )
    }

    return <div key={section.id}>{section.render()}</div>
  }

  const sectionRegistry: ReportSectionConfig[] = [
    {
      ...getReportSectionDefinition('kpi-overview'),
      render: () => <KpiOverview overview={overview} />,
    },
    {
      ...getReportSectionDefinition('business-health-score'),
      render: () => <BusinessHealthCard healthScore={businessHealthScore} />,
    },
    {
      ...getReportSectionDefinition('trend-cards'),
      render: () => <TrendCards metrics={chartMetrics} />,
    },
    {
      ...getReportSectionDefinition('report-intelligence'),
      render: () => <ReportIntelligenceCard hasRealReports={hasRealReports} />,
    },
    {
      ...getReportSectionDefinition('quick-generate'),
      render: () => (
        <QuickGenerateSection onGenerateReport={openGenerateModal} />
      ),
    },
    {
      ...getReportSectionDefinition('opportunities-detected'),
      render: () => (
        <OpportunitiesSection
          opportunities={opportunities}
          onPlaceholder={showPlaceholderMessage}
        />
      ),
    },
    {
      ...getReportSectionDefinition('ai-recommendations'),
      render: () => (
        <AiRecommendationsSection
          recommendations={aiRecommendations}
          workspaceSlug={workspaceSlug}
          onPlaceholder={showPlaceholderMessage}
        />
      ),
    },
    {
      ...getReportSectionDefinition('filters'),
      render: () => (
        <ReportFiltersCard
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          timeRange={timeRange}
          search={search}
          onTypeFilterChange={setTypeFilter}
          onStatusFilterChange={setStatusFilter}
          onTimeRangeChange={setTimeRange}
          onSearchChange={setSearch}
        />
      ),
    },
    {
      ...getReportSectionDefinition('recent-reports'),
      render: () => (
        <RecentReportsCard
          reports={reports}
          filteredReports={filteredReports}
          hasRealReports={hasRealReports}
          onResetFilters={resetFilters}
          onGenerateReport={() => openGenerateModal()}
          onSelectReport={setSelectedReport}
          onPlaceholder={showPlaceholderMessage}
        />
      ),
    },
    {
      ...getReportSectionDefinition('scheduled-reports'),
      render: () => (
        <ScheduledReportsCard
          scheduledReports={scheduledReports}
          onCreateSchedule={openScheduleModal}
        />
      ),
    },
    {
      ...getReportSectionDefinition('recent-changes'),
      render: () => <RecentChangesTimeline changes={recentChanges} />,
    },
    {
      ...getReportSectionDefinition('industry-benchmarks'),
      render: () => <IndustryBenchmarksCard benchmarks={industryBenchmarks} />,
    },
    {
      ...getReportSectionDefinition('business-advisor-scorecard'),
      render: () => <BusinessAdvisorScorecard scorecard={advisorScorecard} />,
    },
    {
      ...getReportSectionDefinition('top-priorities'),
      render: () => (
        <TopPrioritiesCard
          priorities={topPriorities}
          workspaceSlug={workspaceSlug}
          onPlaceholder={showPlaceholderMessage}
        />
      ),
    },
    {
      ...getReportSectionDefinition('estimated-impact'),
      render: () => <EstimatedImpactCard impacts={estimatedImpact} />,
    },
    {
      ...getReportSectionDefinition('report-preview'),
      render: () => (
        <ReportPreviewPanel
          report={selectedReport}
          workspaceSlug={workspaceSlug}
          onGenerateAgain={(reportType) => openGenerateModal(reportType)}
          onPlaceholder={showPlaceholderMessage}
        />
      ),
    },
  ]

  const renderSectionById = (id: ReportSectionId) => {
    const section = sectionRegistry.find((item) => item.id === id)
    return section ? renderReportSection(section) : null
  }

  const renderSectionGroup = (ids: ReportSectionId[], className: string) => {
    const renderedSections = ids
      .map((id) => renderSectionById(id))
      .filter(Boolean)

    if (renderedSections.length === 0) return null

    return <div className={className}>{renderedSections}</div>
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Generate, review, and share the reports that help you understand what’s working, what needs attention, and what to improve next."
        actions={
          <>
            <Button type="button" size="md" onClick={() => openGenerateModal()}>
              Generate report
            </Button>
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={openScheduleModal}
            >
              Schedule report
            </Button>
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={openShareModal}
              leftIcon={<Share2 className="h-4 w-4" aria-hidden="true" />}
            >
              Share
            </Button>
            <Button
              type="button"
              size="md"
              variant="subtle"
              onClick={openCustomizeDrawer}
              leftIcon={<PanelRight className="h-4 w-4" aria-hidden="true" />}
            >
              Customize
            </Button>
          </>
        }
        className="mb-0"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <ChartCard
          title="Reporting center flow"
          description="Reports move from generation to review, sharing, and action."
        >
          <StageRail data={reportCenterStages} />
        </ChartCard>
        <ChartCard
          title="Report mix"
          description="Saved report sections by business focus."
        >
          <DonutBreakdown
            data={reportSnapshotBreakdown}
            centerValue="26"
            centerLabel="Snapshots"
          />
        </ChartCard>
      </section>

      <ChartCard
        title="Saved report signals"
        description="Report types currently driving the most workspace review activity."
      >
        <HorizontalBarList data={savedReportSignals} />
      </ChartCard>

      {renderSectionGroup(['kpi-overview', 'report-intelligence'], 'space-y-5')}

      {renderSectionGroup(
        ['business-health-score', 'top-priorities', 'estimated-impact'],
        'grid gap-4 xl:grid-cols-3',
      )}

      {renderSectionGroup(
        ['opportunities-detected', 'ai-recommendations'],
        'grid gap-5 xl:grid-cols-2',
      )}

      {renderSectionById('report-preview')}

      <ReportActionToolbar
        selectedReport={selectedReport}
        workspaceSlug={workspaceSlug}
        onGenerateAgain={(reportType) => openGenerateModal(reportType)}
        onShare={openShareModal}
        onPlaceholder={showPlaceholderMessage}
      />

      {renderSectionGroup(
        ['trend-cards', 'recent-changes', 'industry-benchmarks'],
        'grid gap-4 xl:grid-cols-3',
      )}

      {renderSectionGroup(
        ['filters', 'recent-reports', 'scheduled-reports', 'quick-generate'],
        'space-y-5',
      )}

      {modalMessage ? (
        <div
          className={`border-brand-primary/30 fixed z-[60] max-w-sm rounded-xl border bg-slate-950 px-4 py-3 text-sm text-cyan-100 shadow-2xl shadow-black/40 ${
            customizeOpen
              ? 'right-5 top-5'
              : 'bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0'
          }`}
          role="status"
          aria-live="polite"
        >
          {modalMessage}
        </div>
      ) : null}

      <GenerateReportModal
        open={modalType === 'generate'}
        defaultReportType={defaultReportType}
        onClose={() => setModalType(null)}
        onPlaceholder={showPlaceholderMessage}
      />
      <ScheduleReportModal
        open={modalType === 'schedule'}
        defaultReportType={defaultReportType}
        onClose={() => setModalType(null)}
        onPlaceholder={showPlaceholderMessage}
      />
      <ShareReportModal
        open={modalType === 'share'}
        workspaceSlug={workspaceSlug}
        selectedReport={selectedReport}
        onClose={() => setModalType(null)}
        onPlaceholder={showPlaceholderMessage}
      />
      <CustomizeReportsDrawer
        open={customizeOpen}
        sections={getOrderedReportSections(
          reportSectionDefinitions,
          sectionLayout,
        )}
        layout={sectionLayout}
        currentPlan={workspacePlan}
        activePresetId={activePresetId}
        hasUnsavedChanges={hasUnsavedLayoutChanges}
        saving={savingLayout}
        onClose={closeCustomizeDrawer}
        onApplyPreset={applyReportPreset}
        onApplyAiLayout={applyAiReportLayout}
        onToggleVisible={setSectionVisibility}
        onToggleCollapsed={setSectionCollapsed}
        onMove={moveReportSection}
        onReorder={reorderReportSections}
        onSetAllVisible={setAllSectionsVisible}
        onReset={resetReportLayout}
        onSave={saveReportLayout}
      />
    </div>
  )
}

function KpiOverview({
  overview,
}: {
  overview: Array<{ label: string; value: string; helper: string }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {overview.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-neutral-text-secondary text-xs font-medium">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-100">
            {item.value}
          </p>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            {item.helper}
          </p>
        </Card>
      ))}
    </div>
  )
}

function ReportIntelligenceCard({
  hasRealReports,
}: {
  hasRealReports: boolean
}) {
  return (
    <Card className="border-brand-primary/20 bg-brand-primary/[0.04] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Report intelligence
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Reports can be generated manually now and will support AI-powered
            summaries as workspace data grows.
          </p>
        </div>
        {!hasRealReports ? <Badge>Preview data</Badge> : null}
      </div>
    </Card>
  )
}

function QuickGenerateSection({
  onGenerateReport,
}: {
  onGenerateReport: (reportType: ReportType) => void
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Quick generate
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Start with a common report template.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {reportTypes.map((reportType) => (
          <Card key={reportType.title} className="flex flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-100">
                {reportType.title}
              </h3>
              <Badge size="xs">{reportType.frequency}</Badge>
            </div>
            <p className="text-neutral-text-secondary mt-2 flex-1 text-xs leading-5">
              {reportType.description}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onGenerateReport(reportType.type)}
              className="mt-4"
            >
              Generate
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ReportFiltersCard({
  typeFilter,
  statusFilter,
  timeRange,
  search,
  onTypeFilterChange,
  onStatusFilterChange,
  onTimeRangeChange,
  onSearchChange,
}: {
  typeFilter: TypeFilter
  statusFilter: StatusFilter
  timeRange: TimeRange
  search: string
  onTypeFilterChange: (value: TypeFilter) => void
  onStatusFilterChange: (value: StatusFilter) => void
  onTimeRangeChange: (value: TimeRange) => void
  onSearchChange: (value: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={(value) => onTypeFilterChange(value as TypeFilter)}
          options={reportTypeOptions.map((option) => ({
            label: option === 'all' ? 'All' : titleCase(option),
            value: option,
          }))}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(value as StatusFilter)}
          options={statusOptions.map((option) => ({
            label: option === 'all' ? 'All' : titleCase(option),
            value: option,
          }))}
        />
        <FilterSelect
          label="Time range"
          value={timeRange}
          onChange={(value) => onTimeRangeChange(value as TimeRange)}
          options={timeRangeOptions.map((option) => ({
            label: option,
            value: option,
          }))}
        />
        <label className="block">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Search
          </span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search reports or creators"
            className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-2 h-10 w-full rounded-xl border border-neutral-border bg-slate-950/50 px-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
          />
        </label>
      </div>
    </Card>
  )
}

function RecentReportsCard({
  reports,
  filteredReports,
  hasRealReports,
  onResetFilters,
  onGenerateReport,
  onSelectReport,
  onPlaceholder,
}: {
  reports: WorkspaceReport[]
  filteredReports: WorkspaceReport[]
  hasRealReports: boolean
  onResetFilters: () => void
  onGenerateReport: () => void
  onSelectReport: (report: WorkspaceReport) => void
  onPlaceholder: (message: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-neutral-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">
              Recent Reports
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              Review generated reports and sharing status.
            </p>
          </div>
          {!hasRealReports ? <Badge>Mock reports</Badge> : null}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No reports yet"
            description="Generate your first report to summarize workspace activity, automation performance, clients, tasks, and growth opportunities."
            actionLabel="Generate first report"
            onAction={onGenerateReport}
          />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Report</TH>
              <TH>Type</TH>
              <TH>Generated</TH>
              <TH>Status</TH>
              <TH>Created by</TH>
              <TH>Shared</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filteredReports.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-10 text-center">
                  <p className="text-sm font-medium text-neutral-100">
                    No reports match your current filters.
                  </p>
                  <p className="text-neutral-text-secondary mx-auto mt-1 max-w-md text-xs">
                    Try changing the type, status, time range, or search query.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onResetFilters}
                    className="mt-4"
                  >
                    Reset filters
                  </Button>
                </TD>
              </TR>
            ) : (
              filteredReports.map((report) => (
                <TR key={report.id}>
                  <TD>
                    <div className="min-w-48">
                      <p className="font-medium text-neutral-100">
                        {report.title}
                      </p>
                      <p className="text-neutral-text-secondary font-mono text-[11px]">
                        {report.id}
                      </p>
                    </div>
                  </TD>
                  <TD className="text-neutral-text-secondary">
                    <Badge variant={typeVariant[report.type]}>
                      {titleCase(report.type)}
                    </Badge>
                  </TD>
                  <TD className="text-neutral-text-secondary">
                    {formatRelativeDate(report.generatedAt)}
                  </TD>
                  <TD>
                    <Badge variant={statusVariant[report.status]}>
                      {titleCase(report.status)}
                    </Badge>
                  </TD>
                  <TD className="text-neutral-text-secondary">
                    {report.createdBy}
                  </TD>
                  <TD>{report.shared ? 'Yes' : 'No'}</TD>
                  <TD>
                    <div className="flex min-w-44 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onSelectReport(report)}
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="subtle"
                        onClick={() =>
                          onPlaceholder(
                            'PDF export will connect to report files soon.',
                          )
                        }
                      >
                        PDF
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          onPlaceholder(
                            'Share links will connect to report publishing soon.',
                          )
                        }
                      >
                        Share link
                      </Button>
                    </div>
                    <ExportActions onPlaceholder={onPlaceholder} compact />
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}
    </Card>
  )
}

function CollapsedReportSection({
  section,
  onExpand,
}: {
  section: ReportSectionDefinition
  onExpand: () => void
}) {
  return (
    <Card className="border-dashed border-neutral-border bg-slate-950/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            {section.label}
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            {section.description}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onExpand}>
          Expand
        </Button>
      </div>
    </Card>
  )
}

function CustomizeReportsDrawer({
  open,
  sections,
  layout,
  currentPlan,
  activePresetId,
  hasUnsavedChanges,
  saving,
  onClose,
  onApplyPreset,
  onApplyAiLayout,
  onToggleVisible,
  onToggleCollapsed,
  onMove,
  onReorder,
  onSetAllVisible,
  onReset,
  onSave,
}: {
  open: boolean
  sections: ReportSectionDefinition[]
  layout: ReportSectionLayout
  currentPlan: Plan
  activePresetId: ReportPresetId | null
  hasUnsavedChanges: boolean
  saving: boolean
  onClose: () => void
  onApplyPreset: (presetId: ReportPresetId) => Promise<boolean>
  onApplyAiLayout: (
    recommendation: AiReportLayoutRecommendation,
  ) => Promise<boolean>
  onToggleVisible: (id: ReportSectionId, visible: boolean) => void
  onToggleCollapsed: (id: ReportSectionId, collapsed: boolean) => void
  onMove: (id: ReportSectionId, direction: -1 | 1) => void
  onReorder: (activeId: ReportSectionId, overId: ReportSectionId) => void
  onSetAllVisible: (visible: boolean) => void
  onReset: () => void
  onSave: () => void
}) {
  const [categoryFilter, setCategoryFilter] = useState<
    ReportSectionCategory | 'all'
  >('all')
  const [widgetSearch, setWidgetSearch] = useState('')
  const [presetSectionExpanded, setPresetSectionExpanded] = useState(true)
  const [aiAdvisorExpanded, setAiAdvisorExpanded] = useState(false)
  const [widgetDensity, setWidgetDensity] =
    useState<WidgetDisplayDensity>('comfortable')
  const [aiLayoutGoal, setAiLayoutGoal] = useState('')
  const [aiRecommendation, setAiRecommendation] =
    useState<AiReportLayoutRecommendation | null>(null)
  const [aiLayoutMessage, setAiLayoutMessage] = useState<string | null>(null)
  const [applyingAiLayout, setApplyingAiLayout] = useState(false)
  const [pendingPreset, setPendingPreset] =
    useState<ReportPresetDefinition | null>(null)
  const [presetMessage, setPresetMessage] = useState<string | null>(null)
  const [appliedPresetId, setAppliedPresetId] = useState<ReportPresetId | null>(
    null,
  )
  const appliedPresetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    if (!open) {
      setPendingPreset(null)
      setPresetMessage(null)
      setAppliedPresetId(null)
      setAiLayoutMessage(null)
      setApplyingAiLayout(false)
      if (appliedPresetTimeoutRef.current) {
        clearTimeout(appliedPresetTimeoutRef.current)
        appliedPresetTimeoutRef.current = null
      }
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pendingPreset) return
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open, pendingPreset])

  useEffect(
    () => () => {
      if (appliedPresetTimeoutRef.current) {
        clearTimeout(appliedPresetTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (aiRecommendation) {
      setAiAdvisorExpanded(true)
    }
  }, [aiRecommendation])

  const visibleCount = useMemo(
    () => sections.filter((section) => layout[section.id]?.visible).length,
    [layout, sections],
  )
  const categoryCounts = useMemo(
    () => getCategoryCounts(sections, layout),
    [layout, sections],
  )
  const query = widgetSearch.trim().toLowerCase()
  const categoryFilteredSections = useMemo(
    () =>
      categoryFilter === 'all'
        ? sections
        : sections.filter(
            (section) => layout[section.id]?.category === categoryFilter,
          ),
    [categoryFilter, layout, sections],
  )
  const filteredSections = useMemo(
    () =>
      query
        ? categoryFilteredSections.filter(
            (section) =>
              section.label.toLowerCase().includes(query) ||
              section.description.toLowerCase().includes(query),
          )
        : categoryFilteredSections,
    [categoryFilteredSections, query],
  )
  const filteredSectionsAllHidden =
    filteredSections.length > 0 &&
    filteredSections.every((section) => !layout[section.id]?.visible)
  const categoryFilters: Array<{
    value: ReportSectionCategory | 'all'
    label: string
    description: string
  }> = useMemo(
    () => [
      {
        value: 'all',
        label: 'All',
        description: 'All dashboard widgets',
      },
      {
        value: 'overview',
        label: 'Overview',
        description: 'High-level dashboard sections',
      },
      {
        value: 'metrics',
        label: 'Metrics',
        description: 'KPI and trend sections',
      },
      {
        value: 'insights',
        label: 'Insights',
        description: 'Recommendations and recent activity sections',
      },
      {
        value: 'reports',
        label: 'Reports',
        description: 'Reporting and history sections',
      },
      {
        value: 'advisor',
        label: 'Advisor',
        description: 'AI business advisor sections',
      },
    ],
    [],
  )
  const selectedCategory = categoryFilters.find(
    (filter) => filter.value === categoryFilter,
  )
  const activePresetName = activePresetId
    ? reportPresetDefinitions.find((preset) => preset.id === activePresetId)
        ?.name
    : null
  const currentLayoutLabel = activePresetId ? activePresetName : 'Custom'
  const aiLayoutUnlocked = planAtLeast(currentPlan, 'Elite')
  const trimmedAiLayoutGoal = aiLayoutGoal.trim()
  const applyPreset = (preset: ReportPresetDefinition) => {
    if (!planAtLeast(currentPlan, preset.requiredPlan)) {
      setPendingPreset(null)
      setPresetMessage(getReportPresetUpgradeMessage(preset))
      return
    }

    setPresetMessage(null)
    setAppliedPresetId(null)
    if (hasUnsavedChanges && activePresetId !== preset.id) {
      setPendingPreset(preset)
      return
    }

    void applyAndMarkPreset(preset.id)
  }
  const applyAndMarkPreset = async (presetId: ReportPresetId) => {
    const applied = await onApplyPreset(presetId)
    if (!applied) return false

    setAppliedPresetId(presetId)
    if (appliedPresetTimeoutRef.current) {
      clearTimeout(appliedPresetTimeoutRef.current)
    }
    appliedPresetTimeoutRef.current = setTimeout(() => {
      setAppliedPresetId((current) => (current === presetId ? null : current))
      appliedPresetTimeoutRef.current = null
    }, 1800)
    return true
  }
  const generateAiLayout = () => {
    if (!aiLayoutUnlocked) {
      setAiLayoutMessage('Upgrade to Elite to generate AI dashboard layouts.')
      return
    }

    if (!trimmedAiLayoutGoal) return

    setAiRecommendation(
      generateAiReportLayoutRecommendation(trimmedAiLayoutGoal),
    )
    setAiLayoutMessage(null)
  }
  const applyAiLayout = async () => {
    if (!aiRecommendation || !aiLayoutUnlocked) return

    setApplyingAiLayout(true)
    const applied = await onApplyAiLayout(aiRecommendation)
    setApplyingAiLayout(false)
    if (applied) {
      setAiLayoutMessage('AI layout applied and saved.')
    } else {
      setAiLayoutMessage('AI layout could not be saved. Try again.')
    }
  }
  const regenerateAiLayout = () => {
    if (!trimmedAiLayoutGoal || !aiLayoutUnlocked) return
    setAiRecommendation(
      generateAiReportLayoutRecommendation(trimmedAiLayoutGoal),
    )
    setAiLayoutMessage(null)
  }
  const clearAiLayout = () => {
    setAiRecommendation(null)
    setAiLayoutMessage(null)
  }
  const confirmPresetApply = async () => {
    const preset = pendingPreset
    if (!preset) return

    const applied = await applyAndMarkPreset(preset.id)
    if (applied) {
      setPendingPreset(null)
    }
  }
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    onReorder(active.id as ReportSectionId, over.id as ReportSectionId)
  }
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    onReorder(active.id as ReportSectionId, over.id as ReportSectionId)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close customize drawer"
        className="hidden flex-1 cursor-default sm:block"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-[760px] flex-col border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100">
                Customize Reports Dashboard
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Control section visibility, ordering, and default collapsed
                states for this workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          <div className="space-y-2 px-5 py-3">
            <section className="rounded-xl border border-white/10 bg-white/[0.025]">
              <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-neutral-100">
                      Dashboard Presets
                    </p>
                    <span
                      className={`w-fit shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        activePresetId
                          ? 'border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-100/75'
                          : 'border-white/10 bg-white/[0.04] text-white/60'
                      }`}
                    >
                      Current layout: {currentLayoutLabel}
                    </span>
                  </div>
                  {presetSectionExpanded ? (
                    <p className="text-neutral-text-secondary mt-1 text-xs">
                      Apply a built-in layout to save it for this workspace.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={
                    presetSectionExpanded
                      ? 'Collapse Dashboard Presets'
                      : 'Expand Dashboard Presets'
                  }
                  aria-expanded={presetSectionExpanded}
                  onClick={() =>
                    setPresetSectionExpanded((expanded) => !expanded)
                  }
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  {presetSectionExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {presetSectionExpanded ? (
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
                    role="listbox"
                    aria-label="Report dashboard presets"
                  >
                    {reportPresetDefinitions.map((preset) => {
                      const locked = !planAtLeast(
                        currentPlan,
                        preset.requiredPlan,
                      )
                      return (
                        <ReportPresetCard
                          key={preset.id}
                          preset={preset}
                          active={activePresetId === preset.id}
                          applied={appliedPresetId === preset.id}
                          locked={locked}
                          onSelect={() => applyPreset(preset)}
                        />
                      )
                    })}
                  </div>
                  {presetMessage ? (
                    <div
                      className="mt-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100/85"
                      role="status"
                      aria-live="polite"
                    >
                      {presetMessage}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section
              className={`rounded-xl border ${
                aiLayoutUnlocked
                  ? 'border-cyan-300/15 bg-cyan-300/[0.035]'
                  : 'border-white/10 bg-white/[0.025]'
              }`}
              onClick={() => {
                if (!aiLayoutUnlocked) {
                  setAiLayoutMessage(
                    'Upgrade to Elite to generate AI dashboard layouts.',
                  )
                }
              }}
            >
              <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles
                      className="h-4 w-4 text-cyan-100/80"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-semibold text-neutral-100">
                      AI Layout Advisor
                    </p>
                    <span className="shrink-0 rounded-full border border-amber-300/15 bg-amber-300/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-100/85">
                      Elite
                    </span>
                  </div>
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    {aiAdvisorExpanded
                      ? 'Describe your business goal and Skillify will build a recommended reporting dashboard.'
                      : 'Generate a dashboard layout from a business goal.'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={
                    aiAdvisorExpanded
                      ? 'Collapse AI Layout Advisor'
                      : 'Expand AI Layout Advisor'
                  }
                  aria-expanded={aiAdvisorExpanded}
                  onClick={(event) => {
                    event.stopPropagation()
                    setAiAdvisorExpanded((expanded) => !expanded)
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  {aiAdvisorExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {aiAdvisorExpanded ? (
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <label className="block">
                    <span className="text-[11px] font-medium text-white/65">
                      Business Goal
                    </span>
                    <input
                      value={aiLayoutGoal}
                      onChange={(event) => {
                        setAiLayoutGoal(event.target.value)
                        setAiLayoutMessage(null)
                      }}
                      disabled={!aiLayoutUnlocked}
                      placeholder="Example: reduce missed leads, improve reviews, monitor automation failures"
                      className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-1 h-9 w-full rounded-xl border border-slate-800 bg-slate-950/55 px-3 text-xs text-neutral-100 outline-none transition placeholder:text-white/35 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55"
                    />
                  </label>
                  <div className="mt-2 space-y-2">
                    <p className="text-neutral-text-secondary text-[11px]">
                      {aiLayoutUnlocked
                        ? 'Elite workspaces can generate and save advisor-created layouts.'
                        : 'AI Layout Advisor is available on Elite.'}
                    </p>
                    <Button
                      type="button"
                      size="xs"
                      className="w-full justify-center"
                      disabled={!aiLayoutUnlocked || !trimmedAiLayoutGoal}
                      onClick={(event) => {
                        event.stopPropagation()
                        generateAiLayout()
                      }}
                      leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                    >
                      Generate AI Layout
                    </Button>
                  </div>
                  {aiRecommendation ? (
                    <div className="mt-2.5 rounded-xl border border-cyan-300/15 bg-slate-950/45 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/60">
                            Recommended Layout
                          </p>
                          <p className="mt-1 text-xs font-semibold text-cyan-50">
                            {aiRecommendation.name}
                          </p>
                          <p className="text-neutral-text-secondary mt-1 text-[11px] leading-5">
                            Generated from: “{aiRecommendation.sourceGoal}”
                          </p>
                        </div>
                        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-2 py-0.5 text-[10px] text-cyan-100/80">
                          {aiRecommendation.visibleSectionIds.length} widgets
                        </span>
                      </div>
                      <p className="text-neutral-text-secondary mt-2 text-[11px] leading-5">
                        {aiRecommendation.explanation}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                            Included
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {aiRecommendation.visibleSectionIds.map((id) => (
                              <span
                                key={id}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/65"
                              >
                                {getReportSectionDefinition(id).label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                            Collapsed
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {aiRecommendation.collapsedSectionIds.length > 0 ? (
                              aiRecommendation.collapsedSectionIds.map((id) => (
                                <span
                                  key={id}
                                  className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/65"
                                >
                                  {getReportSectionDefinition(id).label}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-white/45">
                                None
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {aiLayoutMessage ? (
                        <p
                          className={`mt-2 text-[11px] ${
                            aiLayoutMessage.includes('could not')
                              ? 'text-amber-100/80'
                              : 'text-emerald-100/80'
                          }`}
                          role="status"
                          aria-live="polite"
                        >
                          {aiLayoutMessage}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={clearAiLayout}
                        >
                          Clear
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={!trimmedAiLayoutGoal}
                          onClick={regenerateAiLayout}
                        >
                          Regenerate
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          loading={applyingAiLayout}
                          disabled={applyingAiLayout}
                          onClick={applyAiLayout}
                        >
                          Apply & Save Layout
                        </Button>
                      </div>
                    </div>
                  ) : aiLayoutMessage ? (
                    <p
                      className="mt-2 text-[11px] text-amber-100/80"
                      role="status"
                      aria-live="polite"
                    >
                      {aiLayoutMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <div className="sticky top-0 z-10 border-b border-slate-700/80 bg-slate-950/95 px-5 py-3 shadow-[0_16px_34px_rgba(2,6,23,0.36)] backdrop-blur-2xl transition-all duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-neutral-text-secondary text-xs">
                  {sections.length} dashboard widgets • {visibleCount} shown
                </p>
                <button
                  type="button"
                  onClick={() => onSetAllVisible(true)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/65 transition duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Show All
                </button>
                <button
                  type="button"
                  onClick={() => onSetAllVisible(false)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/65 transition duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  Hide All
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-text-secondary text-[11px]">
                  Widget display
                </span>
                <div
                  className="flex rounded-lg border border-white/10 bg-slate-950/50 p-0.5"
                  role="group"
                  aria-label="Widget display density"
                >
                  {(['comfortable', 'compact'] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => setWidgetDensity(density)}
                      aria-pressed={widgetDensity === density}
                      className={`rounded-md px-2 py-1 text-[11px] capitalize transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
                        widgetDensity === density
                          ? 'bg-white/10 text-white'
                          : 'text-white/45 hover:text-white/75'
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>
              <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                {categoryFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setCategoryFilter(filter.value)}
                    className={categoryFilterClass(
                      filter.value,
                      categoryFilter === filter.value,
                    )}
                  >
                    {filter.label} ({categoryCounts[filter.value]})
                  </button>
                ))}
              </div>
              {selectedCategory ? (
                <p className="text-neutral-text-secondary w-full text-[11px]">
                  {selectedCategory.label}: {selectedCategory.description}
                </p>
              ) : null}
              <label className="w-full">
                <span className="sr-only">Search widgets</span>
                <input
                  value={widgetSearch}
                  onChange={(event) => setWidgetSearch(event.target.value)}
                  placeholder="Search widgets..."
                  className="focus:border-brand-primary/70 focus:ring-brand-primary/20 h-9 w-full rounded-xl border border-slate-800 bg-slate-950/55 px-3 text-sm text-neutral-100 outline-none transition duration-200 placeholder:text-white/35 focus:ring-2"
                />
              </label>
              {query ? (
                <p className="text-neutral-text-secondary w-full text-[11px]">
                  {filteredSections.length > 0
                    ? `${filteredSections.length} ${
                        filteredSections.length === 1 ? 'widget' : 'widgets'
                      } found`
                    : `No widgets match '${widgetSearch.trim()}'`}
                </p>
              ) : null}
              <p className="text-neutral-text-secondary w-full text-[11px]">
                Tip: Drag widgets or use ↑ ↓ buttons to reorder.
              </p>
            </div>
          </div>

          <div className="px-5 py-2.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredSections.map((section) => section.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className={
                    widgetDensity === 'compact' ? 'space-y-1' : 'space-y-1.5'
                  }
                >
                  {filteredSections.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-border bg-slate-900/40 px-4 py-8 text-center shadow-soft transition duration-200">
                      <p className="text-sm font-medium text-neutral-100">
                        No widgets found
                      </p>
                      <p className="text-neutral-text-secondary mt-1 text-xs">
                        Try a different keyword or select another category.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {query ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setWidgetSearch('')}
                          >
                            Clear search
                          </Button>
                        ) : null}
                        {categoryFilter !== 'all' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCategoryFilter('all')}
                          >
                            Show all widgets
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      {filteredSectionsAllHidden ? (
                        <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.04] px-4 py-3 transition duration-200">
                          <p className="text-sm font-medium text-amber-100">
                            No visible widgets in this category
                          </p>
                          <p className="text-neutral-text-secondary mt-1 text-xs">
                            Turn visibility back on or choose another category.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onSetAllVisible(true)}
                            className="mt-3"
                          >
                            Show all widgets
                          </Button>
                        </div>
                      ) : null}
                      {filteredSections.map((section) => {
                        const allIndex = sections.findIndex(
                          (candidate) => candidate.id === section.id,
                        )
                        return (
                          <SortableReportSectionRow
                            key={section.id}
                            section={section}
                            sectionState={layout[section.id]}
                            disabledUp={allIndex === 0}
                            disabledDown={allIndex === sections.length - 1}
                            onToggleVisible={onToggleVisible}
                            onToggleCollapsed={onToggleCollapsed}
                            onMove={onMove}
                            density={widgetDensity}
                          />
                        )
                      })}
                    </>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="border-t border-slate-800 bg-slate-950/95 px-5 py-4">
          <div className="mb-3 flex min-h-5 items-center justify-between gap-3">
            {hasUnsavedChanges ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200">
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]"
                  aria-hidden="true"
                />
                You have unsaved changes
              </p>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-200/55">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                All changes saved
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            >
              Reset Layout
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onSave}
                disabled={!hasUnsavedChanges || saving}
                loading={saving}
                className={
                  hasUnsavedChanges
                    ? 'shadow-[0_0_22px_rgba(34,211,238,0.28)] hover:shadow-[0_0_28px_rgba(34,211,238,0.34)]'
                    : undefined
                }
                leftIcon={
                  saving ? undefined : hasUnsavedChanges ? (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )
                }
              >
                {saving
                  ? 'Saving...'
                  : hasUnsavedChanges
                    ? 'Save Changes'
                    : 'Saved'}
              </Button>
            </div>
          </div>
        </div>
      </aside>
      {pendingPreset ? (
        <PresetConfirmDialog
          presetName={pendingPreset.name}
          onCancel={() => setPendingPreset(null)}
          onConfirm={confirmPresetApply}
        />
      ) : null}
    </div>
  )
}

function ReportPresetCard({
  preset,
  active,
  applied,
  locked,
  onSelect,
}: {
  preset: ReportPresetDefinition
  active: boolean
  applied: boolean
  locked: boolean
  onSelect: () => void
}) {
  const Icon = getReportPresetIcon(preset.icon)
  const planLabel =
    preset.requiredPlan === 'Pro'
      ? locked
        ? 'Requires Pro'
        : 'Pro+'
      : preset.requiredPlan === 'Elite'
        ? locked
          ? 'Requires Elite'
          : 'Elite'
        : 'All plans'
  const stateClasses = active
    ? 'border-cyan-200/60 bg-cyan-300/[0.13] shadow-[0_0_22px_rgba(34,211,238,0.18)]'
    : locked
      ? 'border-white/10 bg-white/[0.025] opacity-60'
      : 'cursor-pointer border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.06] hover:shadow-[0_12px_26px_rgba(34,211,238,0.10)]'

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      aria-disabled={locked}
      onClick={onSelect}
      className={`group h-full min-h-[112px] rounded-xl border px-2.5 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${stateClasses}`}
    >
      <span className="flex h-full items-start gap-2">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            active
              ? 'border-cyan-200/40 bg-cyan-300/20 text-cyan-50'
              : locked
                ? 'border-white/10 bg-slate-950/35 text-white/40'
                : 'border-white/10 bg-slate-950/40 text-white/55 group-hover:text-cyan-100/80'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-h-4 items-start justify-between gap-2">
            <span className="block truncate text-xs font-semibold text-neutral-100">
              {preset.name}
            </span>
            {locked ? (
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-200/70" />
            ) : null}
          </span>
          <span className="mt-1 flex h-5 items-center gap-1.5">
            {active ? (
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-emerald-100/80">
                Active
              </span>
            ) : null}
            {applied ? (
              <span
                className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.10] px-1.5 py-0.5 text-[10px] font-medium text-cyan-50/90 duration-200 animate-in fade-in zoom-in-95"
                role="status"
                aria-live="polite"
              >
                ✓ Saved
              </span>
            ) : null}
          </span>
          <span className="text-neutral-text-secondary line-clamp-2 block text-[11px] leading-4">
            {preset.description}
          </span>
          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/55">
              Includes {preset.visibleSectionIds.length} widgets
            </span>
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                locked
                  ? 'border-amber-300/15 bg-amber-300/[0.08] text-amber-100/80'
                  : 'border-violet-300/15 bg-violet-300/[0.07] text-violet-100/75'
              }`}
            >
              {planLabel}
            </span>
          </span>
        </span>
      </span>
    </button>
  )
}

function PresetConfirmDialog({
  presetName,
  onCancel,
  onConfirm,
}: {
  presetName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <ModalShell
      title="Apply this preset?"
      subtitle="This will replace your current unsaved layout."
      closeLabel="Close preset confirmation"
      onClose={onCancel}
    >
      <p className="text-neutral-text-secondary text-sm leading-6">
        Apply <span className="font-medium text-neutral-100">{presetName}</span>{' '}
        now? You can still review the live preview before saving.
      </p>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm}>
          Apply Preset
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

function SortableReportSectionRow({
  section,
  sectionState,
  disabledUp,
  disabledDown,
  onToggleVisible,
  onToggleCollapsed,
  onMove,
  density,
}: {
  section: ReportSectionDefinition
  sectionState: ReportSectionLayout[ReportSectionId]
  disabledUp: boolean
  disabledDown: boolean
  onToggleVisible: (id: ReportSectionId, visible: boolean) => void
  onToggleCollapsed: (id: ReportSectionId, collapsed: boolean) => void
  onMove: (id: ReportSectionId, direction: -1 | 1) => void
  density: WidgetDisplayDensity
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
  })
  const transformValue = transform
    ? `${CSS.Transform.toString(transform)}${isDragging ? ' scale(1.01)' : ''}`
    : isDragging
      ? 'scale(1.01)'
      : undefined
  const handleReorderKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === 'ArrowUp' && !disabledUp) {
      event.preventDefault()
      onMove(section.id, -1)
    }
    if (event.key === 'ArrowDown' && !disabledDown) {
      event.preventDefault()
      onMove(section.id, 1)
    }
  }
  const compact = density === 'compact'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformValue, transition }}
      className={`rounded-xl border px-3 transition-all duration-200 ease-out ${
        isDragging
          ? 'border-cyan-200/70 bg-slate-800/90 opacity-95 shadow-2xl shadow-cyan-900/55'
          : 'border-slate-800/75 bg-slate-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-slate-700/75'
      } ${sectionState.visible ? 'opacity-100' : 'opacity-[0.63]'} ${
        compact ? 'py-1' : 'py-1.5'
      }`}
    >
      <div
        className={`grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${
          compact ? 'gap-2' : 'gap-3'
        }`}
      >
        <div className="min-w-0 pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={`Reorder widget: ${section.label}`}
              title="Drag to reorder"
              className={`-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/70 transition-all duration-200 hover:scale-[1.08] hover:bg-cyan-300/10 hover:text-cyan-100 hover:shadow-[0_0_16px_rgba(34,211,238,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                isDragging
                  ? 'cursor-grabbing text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.28)]'
                  : 'cursor-grab'
              }`}
              {...attributes}
              {...listeners}
              onKeyDown={handleReorderKeyDown}
            >
              <GripVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            <h3 className="text-sm font-semibold text-neutral-100">
              {section.label}
            </h3>
            <CategoryBadge category={section.category} />
            {!sectionState.visible ? <HiddenBadge /> : null}
          </div>
          <p
            className={`text-neutral-text-secondary mt-0.5 pl-8 ${
              compact
                ? 'line-clamp-1 text-[11px] leading-4'
                : 'text-xs leading-4'
            }`}
          >
            {section.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="text-neutral-text-secondary flex items-center gap-2 text-xs">
            <span>Visible</span>
            <button
              type="button"
              role="switch"
              aria-label={`Toggle ${section.label} visibility`}
              aria-checked={sectionState.visible}
              onClick={() => onToggleVisible(section.id, !sectionState.visible)}
              className={`relative h-5 w-9 rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                sectionState.visible
                  ? 'border-cyan-300/40 bg-cyan-300/25'
                  : 'border-slate-700 bg-slate-950/60'
              }`}
            >
              <span
                className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-all duration-200 ${
                  sectionState.visible ? 'left-[18px]' : 'left-[3px]'
                }`}
              />
            </button>
          </div>

          {sectionState.visible ? (
            <div className="flex rounded-lg border border-slate-700 bg-slate-950/50 p-0.5">
              <button
                type="button"
                aria-label={`Set ${section.label} to expanded by default`}
                onClick={() => onToggleCollapsed(section.id, false)}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
                  !sectionState.collapsed
                    ? 'bg-white/10 text-white'
                    : 'text-white/45 hover:text-white/75'
                }`}
              >
                Expanded
              </button>
              <button
                type="button"
                aria-label={`Set ${section.label} to collapsed by default`}
                onClick={() => onToggleCollapsed(section.id, true)}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
                  sectionState.collapsed
                    ? 'bg-violet-300/15 text-violet-100'
                    : 'text-white/45 hover:text-white/75'
                }`}
              >
                Collapsed
              </button>
            </div>
          ) : (
            <p className="rounded-lg border border-slate-700/60 bg-slate-950/35 px-2.5 py-1 text-[11px] text-white/40">
              Hidden from dashboard
            </p>
          )}

          <div className="flex gap-1">
            <button
              type="button"
              aria-label={`Move ${section.label} up`}
              disabled={disabledUp}
              onClick={() => onMove(section.id, -1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-white/65 transition duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Move ${section.label} down`}
              disabled={disabledDown}
              onClick={() => onMove(section.id, 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-white/65 transition duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScheduledReportsCard({
  scheduledReports,
  onCreateSchedule,
}: {
  scheduledReports: ScheduledReport[]
  onCreateSchedule: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Scheduled Reports
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Recurring reports ready for future delivery automation.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCreateSchedule}
        >
          Create schedule
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {scheduledReports.map((report) => (
          <div
            key={report.id}
            className="rounded-xl border border-neutral-border bg-slate-950/35 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-neutral-100">
                  {report.title}
                </h3>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  {report.frequency}
                </p>
              </div>
              <Badge variant={report.enabled ? 'green' : 'yellow'}>
                {report.enabled ? 'Enabled' : 'Paused'}
              </Badge>
            </div>
            <div className="text-neutral-text-secondary mt-3 grid gap-1 text-xs">
              <p>Recipients: {report.recipients.join(', ')}</p>
              <p>Next run: {report.nextRunAt}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BusinessAdvisorScorecard({
  scorecard,
}: {
  scorecard: AdvisorScorecard
}) {
  return (
    <Card className="border-brand-primary/25 from-brand-primary/10 bg-gradient-to-br via-slate-900/85 to-violet-500/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Business Advisor Scorecard
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
            Consultant-style summary of workspace strengths, risks, and
            opportunities.
          </p>
        </div>
        <Badge variant="blue">{scorecard.status}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <p className="text-neutral-text-secondary text-[10px] uppercase tracking-[0.12em]">
            Grade
          </p>
          <p className="mt-1 text-2xl font-semibold text-cyan-100">
            {scorecard.grade}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <p className="text-neutral-text-secondary text-[10px] uppercase tracking-[0.12em]">
            Score
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-100">
            {scorecard.score} / {scorecard.maxScore}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400"
              style={{
                width: `${Math.round((scorecard.score / scorecard.maxScore) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ScorecardColumn
          title="Strengths"
          items={scorecard.strengths}
          dotClassName="bg-emerald-300"
        />
        <ScorecardColumn
          title="Risks"
          items={scorecard.risks}
          dotClassName="bg-red-300"
        />
        <ScorecardColumn
          title="Opportunities"
          items={scorecard.opportunities}
          dotClassName="bg-cyan-300"
        />
      </div>

      <p className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3 text-xs leading-5 text-cyan-50/90">
        {scorecard.summary}
      </p>
    </Card>
  )
}

function ScorecardColumn({
  title,
  items,
  dotClassName,
}: {
  title: string
  items: AdvisorScorecard['strengths']
  dotClassName: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
      <h3 className="text-xs font-semibold text-neutral-100">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="text-neutral-text-secondary flex gap-2 text-xs leading-4"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`}
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TopPrioritiesCard({
  priorities,
  workspaceSlug,
  onPlaceholder,
}: {
  priorities: ReportPriority[]
  workspaceSlug: string
  onPlaceholder: (message: string) => void
}) {
  return (
    <Card className="p-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-100">
          Top Priorities This Week
        </h2>
        <p className="text-neutral-text-secondary mt-1 text-xs">
          Recommended actions based on current report signals.
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {priorities.map((priority, index) => (
          <div
            key={priority.id}
            className="rounded-xl border border-neutral-border bg-slate-950/35 px-3 py-2.5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/70">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-neutral-100">
                      {priority.title}
                    </p>
                    <Badge variant={impactVariant(priority.impact)}>
                      {titleCase(priority.impact)}
                    </Badge>
                  </div>
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    Impact: {priority.impactNote}
                  </p>
                </div>
              </div>
              {priority.action ? (
                <ActionButton
                  action={priority.action}
                  workspaceSlug={workspaceSlug}
                  onPlaceholder={onPlaceholder}
                  className="sm:shrink-0"
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function EstimatedImpactCard({ impacts }: { impacts: EstimatedImpact[] }) {
  return (
    <Card className="border-emerald-400/20 bg-emerald-400/[0.04] p-4">
      <h2 className="text-sm font-semibold text-neutral-100">
        Estimated Impact
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {impacts.map((impact) => (
          <div
            key={impact.id}
            className={`rounded-xl border bg-slate-950/35 px-3 py-2 ${
              impact.accent === 'green'
                ? 'border-emerald-400/20'
                : 'border-cyan-400/20'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                impact.accent === 'green' ? 'text-emerald-200' : 'text-cyan-200'
              }`}
            >
              {impact.value}
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {impact.label}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BusinessHealthCard({
  healthScore,
}: {
  healthScore: BusinessHealthScore
}) {
  const percent = Math.round((healthScore.score / healthScore.maxScore) * 100)

  return (
    <Card className="border-brand-primary/25 from-brand-primary/10 bg-gradient-to-br via-slate-900/80 to-violet-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-neutral-text-secondary text-xs font-medium">
            Business Health Score
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-semibold text-neutral-100">
              {healthScore.score}
            </span>
            <span className="text-neutral-text-secondary pb-1 text-sm">
              / {healthScore.maxScore}
            </span>
          </div>
        </div>
        <Badge variant="blue">{healthScore.status}</Badge>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-neutral-text-secondary mt-3 text-xs leading-5">
        {healthScore.helper}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {healthScore.signals.map((signal) => (
          <span
            key={signal}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60"
          >
            {signal}
          </span>
        ))}
      </div>
    </Card>
  )
}

function AiRecommendationsSection({
  recommendations,
  workspaceSlug,
  onPlaceholder,
}: {
  recommendations: AiReportRecommendation[]
  workspaceSlug: string
  onPlaceholder: (message: string) => void
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-neutral-100">
          AI Recommendations
        </h2>
        <p className="text-neutral-text-secondary mt-1 text-sm">
          Consultant-style recommendations generated from current workspace
          report signals.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {recommendations.map((recommendation) => (
          <Card key={recommendation.id} className="p-4">
            <h3 className="text-sm font-semibold text-neutral-100">
              {recommendation.title}
            </h3>
            <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
              {recommendation.explanation}
            </p>
            <ActionButton
              action={recommendation.action}
              workspaceSlug={workspaceSlug}
              onPlaceholder={onPlaceholder}
              className="mt-4"
            />
          </Card>
        ))}
      </div>
    </section>
  )
}

function TrendCards({ metrics }: { metrics: ReportChartMetric[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.id} className="p-4">
          <h3 className="text-sm font-semibold text-neutral-100">
            {metric.title}
          </h3>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            {metric.description}
          </p>
          <ChartVisual metric={metric} />
        </Card>
      ))}
    </div>
  )
}

function ChartVisual({ metric }: { metric: ReportChartMetric }) {
  const max = Math.max(...metric.values, 1)

  if (metric.type === 'comparison') {
    return (
      <div className="mt-5 grid gap-3">
        {metric.values.map((value, index) => (
          <div key={metric.labels[index]} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-text-secondary">
                {metric.labels[index]}
              </span>
              <span className="text-neutral-100">{value}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className={
                  index === 0
                    ? 'h-full rounded-full bg-emerald-400'
                    : 'h-full rounded-full bg-amber-400'
                }
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-5 flex h-20 items-end gap-2">
      {metric.values.map((value, index) => (
        <div
          key={`${metric.id}-${metric.labels[index]}`}
          className="flex flex-1 flex-col items-center gap-2"
        >
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-cyan-500/50 to-violet-300/80"
            style={{ height: `${Math.max(18, (value / max) * 72)}px` }}
          />
          <span className="text-neutral-text-secondary text-[10px]">
            {metric.labels[index]}
          </span>
        </div>
      ))}
    </div>
  )
}

function RecentChangesTimeline({ changes }: { changes: ReportChangeEvent[] }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-neutral-100">Recent Changes</h2>
      <div className="mt-4 space-y-3">
        {changes.map((change) => (
          <div key={change.id} className="flex gap-3">
            <RecentChangeIcon kind={change.kind} />
            <div className="min-w-0">
              <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
                {change.when}
              </p>
              <p className="mt-1 text-sm text-neutral-100">{change.title}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function RecentChangeIcon({ kind }: { kind: ReportChangeEvent['kind'] }) {
  const className = 'h-3.5 w-3.5'

  if (kind === 'warning') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10 text-red-200">
        <AlertTriangle className={className} aria-hidden="true" />
      </span>
    )
  }

  if (kind === 'clients') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
        <Users className={className} aria-hidden="true" />
      </span>
    )
  }

  if (kind === 'report') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-400/20 bg-violet-400/10 text-violet-200">
        <FileText className={className} aria-hidden="true" />
      </span>
    )
  }

  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
      <CheckCircle2 className={className} aria-hidden="true" />
    </span>
  )
}

function IndustryBenchmarksCard({
  benchmarks,
}: {
  benchmarks: IndustryBenchmark[]
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-neutral-100">
        Industry Benchmarks
      </h2>
      <div className="mt-4 space-y-2.5">
        {benchmarks.map((benchmark) => (
          <div
            key={benchmark.id}
            className="rounded-xl border border-neutral-border bg-slate-950/35 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-100">
                {benchmark.metric}
              </p>
              <Badge variant={benchmarkVariant(benchmark.status)}>
                {benchmark.status === 'ahead'
                  ? 'Ahead'
                  : benchmark.status === 'behind'
                    ? 'Behind'
                    : 'Watch'}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-neutral-text-secondary">Your value</p>
                <p className="mt-1 font-semibold text-neutral-100">
                  {benchmark.yourValue}
                </p>
              </div>
              <div>
                <p className="text-neutral-text-secondary">Industry average</p>
                <p className="mt-1 font-semibold text-neutral-100">
                  {benchmark.industryAverage}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function OpportunitiesSection({
  opportunities,
  onPlaceholder,
}: {
  opportunities: ReportOpportunity[]
  onPlaceholder: (message: string) => void
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-neutral-100">
          Opportunities Detected
        </h2>
        <p className="text-neutral-text-secondary mt-1 text-sm">
          Workspace signals that may become automations, process improvements,
          or advisor recommendations.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {opportunities.map((opportunity) => (
          <Card key={opportunity.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <Badge variant={opportunityVariant(opportunity.type)}>
                {titleCase(opportunity.type)}
              </Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-neutral-100">
              {opportunity.title}
            </h3>
            <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
              {opportunity.body}
            </p>
            <p className="mt-3 text-xs font-medium text-cyan-100">
              {opportunity.impact}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() =>
                onPlaceholder(
                  `${opportunity.cta} will connect to workspace recommendations soon.`,
                )
              }
            >
              {opportunity.cta}
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ReportPreviewPanel({
  report,
  workspaceSlug,
  onGenerateAgain,
  onPlaceholder,
}: {
  report: WorkspaceReport | null
  workspaceSlug: string
  onGenerateAgain: (reportType: ReportType) => void
  onPlaceholder: (message: string) => void
}) {
  if (!report) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-neutral-100">
          Report Preview
        </h2>
        <p className="text-neutral-text-secondary mt-2 text-sm">
          Select a report to preview its summary, metrics, and recommended next
          steps.
        </p>
      </Card>
    )
  }

  return (
    <Card className="self-start p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-100">
              Report Preview
            </h2>
            <Badge variant="purple">AI Business Advisor</Badge>
          </div>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            {report.title}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="purple">AI Summary</Badge>
          <Badge variant={statusVariant[report.status]}>
            {titleCase(report.status)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => onGenerateAgain(report.type)}
        >
          Generate Again
        </Button>
        <Button
          type="button"
          size="sm"
          variant="subtle"
          onClick={() =>
            onPlaceholder(
              'PDF downloads will connect to generated report files soon.',
            )
          }
        >
          Download PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onPlaceholder(
              'Report sharing will connect to secure share links soon.',
            )
          }
        >
          Share
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onPlaceholder(
              'Email delivery will connect to report delivery soon.',
            )
          }
        >
          Email
        </Button>
      </div>

      <ExportActions onPlaceholder={onPlaceholder} />

      <div className="border-brand-primary/25 bg-brand-primary/[0.05] mt-4 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-neutral-100">
            Ask AI Coach about this report
          </p>
          <Link
            href={`/dashboard/${workspaceSlug}/ai-coach?prompt=${encodeURIComponent(`Review report: ${report.title}`)}`}
            className="border-brand-primary/70 hover:bg-brand-primary/90 inline-flex h-8 items-center rounded-xl border bg-brand-primary px-3 text-xs font-medium text-white transition-colors"
          >
            Ask AI Coach
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {advisorPrompts.map((prompt) => (
            <Link
              key={prompt}
              href={`/dashboard/${workspaceSlug}/ai-coach?prompt=${encodeURIComponent(prompt)}`}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {prompt}
            </Link>
          ))}
        </div>
      </div>

      <section className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Executive summary
        </h3>
        <p className="mt-2 text-sm leading-6 text-neutral-100">
          Most systems are operating normally, but one failed automation and
          three overdue tasks need attention before next week.
        </p>
      </section>

      <section className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Key metrics
        </h3>
        <div className="mt-3 grid gap-2">
          {report.metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-4 rounded-lg border border-neutral-border bg-slate-950/35 px-3 py-2"
            >
              <span className="text-neutral-text-secondary text-xs">
                {metric.label}
              </span>
              <span className="text-right text-xs font-medium text-neutral-100">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Automation issues
        </h3>
        <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
          One failed execution requires review. Failed automations and
          bottlenecks will be summarized here as real execution data grows.
        </p>
      </section>

      <section className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Client and task highlights
        </h3>
        <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
          Three tasks are overdue. Client follow-ups, updates, and communication
          activity will be grouped into report highlights.
        </p>
      </section>

      <section className="mt-5">
        <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
          Recommended next steps
        </h3>
        <ul className="mt-3 space-y-2.5">
          {[
            {
              title: 'Review the failed lead follow-up workflow.',
              reason: 'Recover missed leads before response delays compound.',
              action: { label: 'Open Workflow', kind: 'workflow' },
            },
            {
              title: 'Enable review requests for completed client work.',
              reason: 'Use completed work to capture 14 review opportunities.',
              action: { label: 'Create Workflow', kind: 'workflow' },
            },
            {
              title: 'Clear overdue follow-up tasks before next week.',
              reason: 'Reduce risk from delayed client and lead responses.',
              action: { label: 'View Task', kind: 'task' },
            },
            {
              title:
                'Ask AI Coach to identify the highest-impact automation opportunity.',
              reason: 'Prioritize the workflow most likely to save time.',
              action: { label: 'Ask AI Coach', kind: 'ai-coach' },
            },
          ].map((recommendation) => (
            <li
              key={recommendation.title}
              className="rounded-xl border border-neutral-border bg-slate-950/35 px-3 py-2.5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex gap-2 text-sm font-medium leading-5 text-neutral-100">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                    <span>{recommendation.title}</span>
                  </div>
                  <p className="text-neutral-text-secondary mt-1 pl-3.5 text-xs leading-5">
                    {recommendation.reason}
                  </p>
                </div>
                <ActionButton
                  action={recommendation.action as ReportPriority['action']}
                  workspaceSlug={workspaceSlug}
                  onPlaceholder={onPlaceholder}
                  className="sm:shrink-0"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Card>
  )
}

function ReportActionToolbar({
  selectedReport,
  workspaceSlug,
  onGenerateAgain,
  onShare,
  onPlaceholder,
}: {
  selectedReport: WorkspaceReport | null
  workspaceSlug: string
  onGenerateAgain: (reportType: ReportType) => void
  onShare: () => void
  onPlaceholder: (message: string) => void
}) {
  const reportType = selectedReport?.type ?? 'summary'

  return (
    <Card className="border-cyan-300/15 bg-cyan-300/[0.035] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Report Actions
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Turn the current business review into an update, export, or AI
            follow-up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => onGenerateAgain(reportType)}
          >
            Generate Again
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onPlaceholder(
                'PDF downloads will connect to generated report files soon.',
              )
            }
          >
            Download PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onPlaceholder(
                'Email delivery will connect to report delivery soon.',
              )
            }
          >
            Email
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onShare}>
            Share
          </Button>
          <Link
            href={`/dashboard/${workspaceSlug}/ai-coach?prompt=${encodeURIComponent(
              selectedReport
                ? `Review report: ${selectedReport.title}`
                : 'What should I prioritize from this report?',
            )}`}
            className="border-brand-primary/70 hover:bg-brand-primary/90 inline-flex h-8 items-center rounded-xl border bg-brand-primary px-3 text-xs font-medium text-white transition-colors"
          >
            Ask AI Coach
          </Link>
        </div>
      </div>
    </Card>
  )
}

function ExportActions({
  onPlaceholder,
  compact,
}: {
  onPlaceholder: (message: string) => void
  compact?: boolean
}) {
  const exports = ['CSV', 'Excel', 'Email'] as const

  return (
    <div
      className={
        compact ? 'mt-2 flex flex-wrap gap-2' : 'mt-3 flex flex-wrap gap-2'
      }
    >
      {exports.map((label) => (
        <Button
          key={label}
          type="button"
          size="xs"
          variant="outline"
          onClick={() =>
            onPlaceholder(
              `${label} export will connect to generated report data soon.`,
            )
          }
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

function GenerateReportModal({
  open,
  defaultReportType,
  onClose,
  onPlaceholder,
}: {
  open: boolean
  defaultReportType: ReportType
  onClose: () => void
  onPlaceholder: (message: string) => void
}) {
  const [reportType, setReportType] = useState<ReportType>(defaultReportType)
  const [timeRange, setTimeRange] = useState('Last 30 days')
  const [includeAutomation, setIncludeAutomation] = useState(true)
  const [includeTasks, setIncludeTasks] = useState(true)
  const [includeClients, setIncludeClients] = useState(true)
  const [includeAi, setIncludeAi] = useState(true)
  const [inlineMessage, setInlineMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReportType(defaultReportType)
      setInlineMessage(null)
    }
  }, [defaultReportType, open])

  if (!open) return null

  const submit = () => {
    const message =
      'Report generation will connect to live workspace data soon.'
    setInlineMessage(message)
    onPlaceholder(message)
  }

  return (
    <ModalShell title="Generate Report" onClose={onClose}>
      <div className="grid gap-4">
        <FilterSelect
          label="Report type"
          value={reportType}
          onChange={(value) => setReportType(value as ReportType)}
          options={reportTypes.map((type) => ({
            label: type.title,
            value: type.type,
          }))}
        />

        <FilterSelect
          label="Time range"
          value={timeRange}
          onChange={setTimeRange}
          options={[
            'Last 7 days',
            'Last 30 days',
            'Last quarter',
            'Custom',
          ].map((value) => ({ label: value, value }))}
        />

        <div>
          <p className="text-neutral-text-secondary text-xs font-medium">
            Include
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <CheckboxField
              label="Automation metrics"
              checked={includeAutomation}
              onChange={setIncludeAutomation}
            />
            <CheckboxField
              label="Task summaries"
              checked={includeTasks}
              onChange={setIncludeTasks}
            />
            <CheckboxField
              label="Client activity"
              checked={includeClients}
              onChange={setIncludeClients}
            />
            <CheckboxField
              label="AI recommendations"
              checked={includeAi}
              onChange={setIncludeAi}
            />
          </div>
        </div>

        {inlineMessage ? <InlineNotice>{inlineMessage}</InlineNotice> : null}
      </div>

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={submit}>
          Generate report
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

function ScheduleReportModal({
  open,
  defaultReportType,
  onClose,
  onPlaceholder,
}: {
  open: boolean
  defaultReportType: ReportType
  onClose: () => void
  onPlaceholder: (message: string) => void
}) {
  const [reportType, setReportType] = useState<ReportType>(defaultReportType)
  const [frequency, setFrequency] = useState('Weekly')
  const [deliveryDay, setDeliveryDay] = useState('Monday')
  const [recipients, setRecipients] = useState('owner@skillify.local')
  const [includeAi, setIncludeAi] = useState(true)
  const [inlineMessage, setInlineMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReportType(defaultReportType)
      setInlineMessage(null)
    }
  }, [defaultReportType, open])

  if (!open) return null

  const submit = () => {
    const message =
      'Report scheduling will connect to live workspace delivery soon.'
    setInlineMessage(message)
    onPlaceholder(message)
  }

  return (
    <ModalShell title="Schedule Report" onClose={onClose}>
      <div className="grid gap-4">
        <FilterSelect
          label="Report type"
          value={reportType}
          onChange={(value) => setReportType(value as ReportType)}
          options={reportTypes.map((type) => ({
            label: type.title,
            value: type.type,
          }))}
        />

        <FilterSelect
          label="Frequency"
          value={frequency}
          onChange={setFrequency}
          options={['Weekly', 'Monthly', 'Quarterly'].map((value) => ({
            label: value,
            value,
          }))}
        />

        <FilterSelect
          label="Delivery day"
          value={deliveryDay}
          onChange={setDeliveryDay}
          options={[
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Month end',
          ].map((value) => ({ label: value, value }))}
        />

        <label className="block">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Recipients
          </span>
          <input
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="email@example.com"
            className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-2 h-10 w-full rounded-xl border border-neutral-border bg-slate-950/50 px-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
          />
        </label>

        <CheckboxField
          label="Include AI summary"
          checked={includeAi}
          onChange={setIncludeAi}
        />

        {inlineMessage ? <InlineNotice>{inlineMessage}</InlineNotice> : null}
      </div>

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={submit}>
          Create schedule
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

function ShareReportModal({
  open,
  workspaceSlug,
  selectedReport,
  onClose,
  onPlaceholder,
}: {
  open: boolean
  workspaceSlug: string
  selectedReport: WorkspaceReport | null
  onClose: () => void
  onPlaceholder: (message: string) => void
}) {
  const [deliveryMethod, setDeliveryMethod] =
    useState<ShareDeliveryMethod>('email')
  const [recipients, setRecipients] = useState('')
  const [permission, setPermission] = useState<SharePermission>('view')
  const [expiration, setExpiration] = useState<ShareExpiration>('30d')
  const [inlineMessage, setInlineMessage] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDeliveryMethod('email')
      setRecipients('')
      setPermission('view')
      setExpiration('30d')
      setInlineMessage(null)
      setInlineError(null)
    }
  }, [open])

  if (!open) return null

  const mockShareUrl = `https://skillify.tech/share/reports/${encodeURIComponent(selectedReport?.id ?? 'mock-report-id')}?workspace=${encodeURIComponent(workspaceSlug)}`
  const recipientList = recipients
    .split(/[,\n;]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean)
  const invalidRecipients = recipientList.filter(
    (recipient) => !isValidEmail(recipient),
  )
  const recipientError =
    recipients.trim() && invalidRecipients.length > 0
      ? `Check recipient email: ${invalidRecipients[0]}`
      : null
  const sendDisabled =
    deliveryMethod === 'pdf' ||
    deliveryMethod === 'csv' ||
    (deliveryMethod === 'email' &&
      (recipientList.length === 0 || invalidRecipients.length > 0))
  const primaryLabel =
    deliveryMethod === 'link'
      ? 'Copy Link'
      : deliveryMethod === 'pdf' || deliveryMethod === 'csv'
        ? 'Coming Soon'
        : 'Send Report'

  const handleSend = async () => {
    setInlineMessage(null)
    setInlineError(null)

    if (deliveryMethod === 'email') {
      if (recipientList.length === 0) {
        setInlineError('Add at least one recipient email.')
        return
      }

      if (invalidRecipients.length > 0) {
        setInlineError(recipientError ?? 'Check recipient emails.')
        return
      }

      const message = 'Report sent.'
      setInlineMessage(message)
      onPlaceholder(message)
      return
    }

    if (deliveryMethod === 'link') {
      try {
        await navigator.clipboard.writeText(mockShareUrl)
        const message = 'Share link copied.'
        setInlineMessage(message)
        onPlaceholder(message)
      } catch {
        const message =
          'Share link is ready, but clipboard access was unavailable.'
        setInlineMessage(message)
        onPlaceholder(message)
      }
      return
    }

    const message = 'This share delivery method is coming soon.'
    setInlineMessage(message)
    onPlaceholder(message)
  }

  return (
    <ModalShell
      title="Share Report"
      subtitle="Share reports with teammates, clients, or external stakeholders."
      closeLabel="Close share modal"
      onClose={onClose}
    >
      <div className="grid gap-5">
        <section className="rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-3">
          <h3 className="text-sm font-semibold text-neutral-100">
            Sharing Options
          </h3>
          <p className="text-neutral-text-secondary mt-1 text-sm leading-5">
            Choose how you want to deliver this report.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-neutral-100">
            Delivery Method
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ShareMethodOption
              label="Email"
              description="Send this report to one or more recipients."
              value="email"
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              selected={deliveryMethod === 'email'}
              onSelect={setDeliveryMethod}
            />
            <ShareMethodOption
              label="Copy Share Link"
              description="Create a secure link you can paste anywhere."
              value="link"
              icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
              selected={deliveryMethod === 'link'}
              onSelect={setDeliveryMethod}
            />
            <ShareMethodOption
              label="Download PDF"
              description="Export a polished report document."
              value="pdf"
              icon={<Download className="h-4 w-4" aria-hidden="true" />}
              selected={deliveryMethod === 'pdf'}
              onSelect={setDeliveryMethod}
              disabled
              badge="Coming soon"
            />
            <ShareMethodOption
              label="Export CSV"
              description="Download the report data."
              value="csv"
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              selected={deliveryMethod === 'csv'}
              onSelect={setDeliveryMethod}
              disabled
              badge="Coming soon"
            />
          </div>
        </section>

        <label className="block">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Recipients
          </span>
          <input
            type="text"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="alex@example.com, client@example.com"
            className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-2 h-10 w-full rounded-xl border border-neutral-border bg-slate-950/50 px-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
            aria-describedby="share-recipients-help"
          />
          <p
            id="share-recipients-help"
            className="text-neutral-text-secondary mt-1 text-[11px]"
          >
            Separate multiple recipients with commas, semicolons, or new lines.
          </p>
          {recipientError ? (
            <p className="mt-1 text-[11px] font-medium text-rose-200">
              {recipientError}
            </p>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <FilterSelect
            label="Permissions"
            value={permission}
            onChange={(value) => setPermission(value as SharePermission)}
            options={[
              { label: 'View only', value: 'view' },
              { label: 'View + download', value: 'download' },
            ]}
          />

          <FilterSelect
            label="Link Expiration"
            value={expiration}
            onChange={(value) => setExpiration(value as ShareExpiration)}
            options={[
              { label: 'Never', value: 'never' },
              { label: '7 days', value: '7d' },
              { label: '30 days', value: '30d' },
              { label: '90 days', value: '90d' },
            ]}
          />
        </div>

        {inlineError ? (
          <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {inlineError}
          </div>
        ) : null}
        {inlineMessage ? <InlineNotice>{inlineMessage}</InlineNotice> : null}
      </div>

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSend}
          disabled={sendDisabled}
          leftIcon={
            deliveryMethod === 'link' ? (
              <Link2 className="h-4 w-4" aria-hidden="true" />
            ) : deliveryMethod === 'email' ? (
              <Send className="h-4 w-4" aria-hidden="true" />
            ) : undefined
          }
        >
          {primaryLabel}
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

function ShareMethodOption({
  label,
  description,
  value,
  icon,
  selected,
  onSelect,
  disabled,
  badge,
}: {
  label: string
  description: string
  value: ShareDeliveryMethod
  icon: ReactNode
  selected: boolean
  onSelect: (value: ShareDeliveryMethod) => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex min-h-20 items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
        selected
          ? 'border-cyan-300/45 bg-cyan-300/10 text-cyan-50'
          : 'border-neutral-border bg-slate-950/35 text-neutral-100 hover:border-slate-700 hover:bg-slate-900/60'
      } ${disabled ? 'opacity-60' : ''}`}
      aria-pressed={selected}
      aria-disabled={disabled}
    >
      <span
        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          selected
            ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100'
            : 'border-white/10 bg-white/[0.04] text-white/55'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{label}</span>
          {badge ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/55">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-neutral-text-secondary mt-1 block text-xs leading-5">
          {description}
        </span>
      </span>
    </button>
  )
}

function ModalShell({
  title,
  subtitle,
  closeLabel = 'Close modal',
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  closeLabel?: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = getFocusableElements(dialog)
    focusable[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements(dialog)
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-modal-title"
        aria-describedby={subtitle ? 'reports-modal-subtitle' : undefined}
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="reports-modal-title"
              className="text-lg font-semibold text-neutral-100"
            >
              {title}
            </h2>
            {subtitle ? (
              <p
                id="reports-modal-subtitle"
                className="text-neutral-text-secondary mt-1 text-sm leading-5"
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
      {children}
    </div>
  )
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled'))
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-neutral-border bg-slate-950/35 px-3 py-2 text-sm text-neutral-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-cyan-400"
      />
      <span>{label}</span>
    </label>
  )
}

function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
      {children}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <label className="block">
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus:border-brand-primary/70 focus:ring-brand-primary/20 mt-2 h-10 w-full rounded-xl border border-neutral-border bg-slate-950/50 px-3 text-sm text-neutral-100 outline-none transition focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ActionButton({
  action,
  workspaceSlug,
  onPlaceholder,
  className,
}: {
  action?: ReportPriority['action']
  workspaceSlug: string
  onPlaceholder: (message: string) => void
  className?: string
}) {
  if (!action) return null

  if (action.kind === 'ai-coach') {
    return (
      <Link
        href={`/dashboard/${workspaceSlug}/ai-coach?prompt=${encodeURIComponent(action.label)}`}
        className={`border-brand-primary/70 hover:bg-brand-primary/90 inline-flex h-8 items-center rounded-xl border bg-brand-primary px-3 text-xs font-medium text-white transition-colors ${className ?? ''}`}
      >
        {action.label}
      </Link>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      onClick={() =>
        onPlaceholder(
          `${action.label} will connect to live workspace data soon.`,
        )
      }
    >
      {action.label}
    </Button>
  )
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function opportunityVariant(type: ReportOpportunity['type']): BadgeVariant {
  if (type === 'revenue') return 'green'
  if (type === 'risk') return 'red'
  return 'blue'
}

function impactVariant(impact: ReportPriority['impact']): BadgeVariant {
  if (impact === 'high') return 'red'
  if (impact === 'medium') return 'yellow'
  return 'blue'
}

function benchmarkVariant(status: IndustryBenchmark['status']): BadgeVariant {
  if (status === 'ahead') return 'green'
  if (status === 'behind') return 'red'
  return 'yellow'
}

function CategoryBadge({ category }: { category: ReportSectionCategory }) {
  const styles: Record<ReportSectionCategory, string> = {
    overview: 'border-blue-300/15 bg-blue-300/[0.07] text-blue-100/80',
    metrics: 'border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-100/80',
    insights: 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-100/80',
    reports: 'border-violet-300/15 bg-violet-300/[0.07] text-violet-100/80',
    advisor: 'border-amber-300/15 bg-amber-300/[0.08] text-amber-100/80',
  }

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${styles[category]}`}
    >
      {categoryLabel(category)}
    </span>
  )
}

function categoryFilterClass(
  category: ReportSectionCategory | 'all',
  selected: boolean,
) {
  const selectedStyles: Record<ReportSectionCategory | 'all', string> = {
    all: 'border-white/20 bg-white/10 text-white',
    overview: 'border-blue-300/35 bg-blue-300/10 text-blue-100',
    metrics: 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100',
    insights: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100',
    reports: 'border-violet-300/35 bg-violet-300/10 text-violet-100',
    advisor: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
  }
  const idleStyles: Record<ReportSectionCategory | 'all', string> = {
    all: 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/80',
    overview:
      'border-blue-300/10 bg-blue-300/[0.03] text-blue-100/55 hover:bg-blue-300/[0.07] hover:text-blue-100/85',
    metrics:
      'border-cyan-300/10 bg-cyan-300/[0.03] text-cyan-100/55 hover:bg-cyan-300/[0.07] hover:text-cyan-100/85',
    insights:
      'border-emerald-300/10 bg-emerald-300/[0.03] text-emerald-100/55 hover:bg-emerald-300/[0.07] hover:text-emerald-100/85',
    reports:
      'border-violet-300/10 bg-violet-300/[0.03] text-violet-100/55 hover:bg-violet-300/[0.07] hover:text-violet-100/85',
    advisor:
      'border-amber-300/10 bg-amber-300/[0.03] text-amber-100/55 hover:bg-amber-300/[0.07] hover:text-amber-100/85',
  }

  return `rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
    selected ? selectedStyles[category] : idleStyles[category]
  }`
}

function getCategoryCounts(
  sections: ReportSectionDefinition[],
  layout: ReportSectionLayout,
) {
  const counts: Record<ReportSectionCategory | 'all', number> = {
    all: sections.length,
    overview: 0,
    metrics: 0,
    insights: 0,
    reports: 0,
    advisor: 0,
  }

  sections.forEach((section) => {
    const category = layout[section.id]?.category ?? section.category
    counts[category] += 1
  })

  return counts
}

function HiddenBadge() {
  return (
    <span className="rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-300/75">
      Hidden
    </span>
  )
}

function categoryLabel(category: ReportSectionCategory) {
  if (category === 'overview') return 'Overview'
  if (category === 'metrics') return 'Metrics'
  if (category === 'insights') return 'Insights'
  if (category === 'reports') return 'Reports'
  return 'Advisor'
}

function isReportSectionCategory(
  value: string,
): value is ReportSectionCategory {
  return (
    value === 'overview' ||
    value === 'metrics' ||
    value === 'insights' ||
    value === 'reports' ||
    value === 'advisor'
  )
}

function getReportSectionDefinition(id: ReportSectionId) {
  const definition = reportSectionDefinitions.find(
    (section) => section.id === id,
  )
  if (!definition) {
    throw new Error(`Missing reports section definition: ${id}`)
  }
  return definition
}

function getOrderedReportSections<T extends ReportSectionDefinition>(
  sections: T[],
  layout: ReportSectionLayout,
) {
  return [...sections].sort(
    (a, b) => (layout[a.id]?.order ?? 0) - (layout[b.id]?.order ?? 0),
  )
}

function getVisibleReportSectionsByZone<T extends ReportSectionConfig>(
  sections: T[],
  layout: ReportSectionLayout,
  zone: ReportSectionZone,
) {
  return getOrderedReportSections(sections, layout).filter(
    (section) => section.zone === zone && layout[section.id]?.visible,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatRelativeDate(value: string | null) {
  if (!value) return '-'

  const now = new Date()
  const date = new Date(value)
  const diffDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) /
      (24 * 60 * 60 * 1000),
  )

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return 'Last week'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

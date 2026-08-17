import type {
  ChartPoint,
  WorkspaceCommandCenterData,
} from '@/components/dashboard/command-center/WorkspaceCommandCenter'
import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import { demoLeads, demoOpportunities } from '@/lib/sales/demoSalesRecords'
import { createMockServiceRequests } from '@/lib/service-requests/mockServiceRequests'
import { createMockWorkspaceTasks } from '@/lib/tasks/demoTasks'
import {
  createDemoWorkspaceOwners,
  getOwnerName,
} from '@/lib/workspace-ownership'
import { applyWorkspaceClientDerivations } from '@/lib/workspace-records/businessRules'
import {
  getRecognizedRevenue,
  getCustomerLifetimeValue,
} from '@/lib/revenue/revenueResolver'
import { centsToDollars, formatRevenueCurrency } from '@/lib/revenue/money'
import {
  getDashboardPriorityTasks,
  getDueOrOverdueOpenTasks,
  getOpenServiceRequests,
  getUrgentOpenServiceRequests,
  selectActiveAutomations,
  selectLeadsNeedingFollowUp,
  selectNewLeads,
  selectOpenOpportunities,
  selectLostOpportunities,
  selectWonOpportunities,
} from '@/lib/workspace-records/relationships'

export type WorkspaceAutomationRunView = {
  id: string
  automationId: string
  automationName: string
  status: string
  startedAt: Date
  finishedAt: Date | null
  durationMs: number | null
}

export type WorkspaceCommandSource = {
  id: string
  name: string
  slug: string
  members: unknown[]
  automations: Array<{
    id: string
    name: string
    status?: string
    runs: WorkspaceAutomationRunView[]
  }>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  if (value >= 1000) return `$${Math.round(value / 100) / 10}k`
  return formatCurrency(value)
}

function formatCompactCents(value: number) {
  return formatCompactCurrency(centsToDollars(value))
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatDurationMs(durationMs: number | null) {
  if (durationMs == null) return '—'
  if (durationMs < 1000) return `${durationMs} ms`
  return `${Math.round(durationMs / 100) / 10}s`
}

function buildRecentRunSeries(
  runs: WorkspaceAutomationRunView[],
): ChartPoint[] {
  const now = new Date()
  return Array.from({ length: 30 }).map((_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (29 - index))
    const key = dateKey(day)
    const dayRuns = runs.filter((run) => dateKey(run.startedAt) === key)
    return {
      label: formatShortDate(day),
      rangeLabel: formatShortDate(day),
      success: dayRuns.filter((run) => run.status === 'SUCCESS').length,
      failed: dayRuns.filter((run) => run.status === 'FAILED').length,
      value: dayRuns.length,
    }
  })
}

type DashboardModuleVisibility = {
  leads: boolean
  opportunities: boolean
  sales: boolean
  clients: boolean
  serviceRequests: boolean
  tasks: boolean
}

function getDashboardModules(
  capabilities?: WorkspaceCapabilities,
): DashboardModuleVisibility {
  if (!capabilities) {
    return {
      leads: true,
      opportunities: true,
      sales: true,
      clients: true,
      serviceRequests: true,
      tasks: true,
    }
  }

  return {
    leads: capabilities.modules.leads,
    opportunities: capabilities.modules.opportunities,
    sales: capabilities.modules.sales,
    clients: capabilities.modules.clients,
    serviceRequests: !capabilities.commerce.commerceEnabled,
    tasks: !capabilities.commerce.commerceEnabled,
  }
}

function getDashboardTerms(capabilities?: WorkspaceCapabilities) {
  if (!capabilities) {
    return {
      leadPlural: 'Leads',
      opportunityPlural: 'Opportunities',
      customerSingular: 'Client',
      customerPlural: 'Clients',
      serviceRequestPlural: 'Service Requests',
      taskPlural: 'Tasks',
      salesLabel: 'Sales',
    }
  }

  const recordTerms = getWorkspaceRecordTerminology(capabilities)
  return {
    leadPlural: capabilities.terminology.leadPlural,
    opportunityPlural: capabilities.terminology.opportunityPlural,
    customerSingular: recordTerms.customerSingular,
    customerPlural: recordTerms.customerPlural,
    serviceRequestPlural: recordTerms.serviceRequestPlural,
    taskPlural: recordTerms.taskPlural,
    salesLabel: capabilities.terminology.salesLabel,
  }
}

export function buildWorkspaceCommandCenterData({
  workspace,
  runs,
  capabilities,
}: {
  workspace: WorkspaceCommandSource
  runs: WorkspaceAutomationRunView[]
  capabilities?: WorkspaceCapabilities
}): WorkspaceCommandCenterData {
  const successfulRuns = runs.filter((run) => run.status === 'SUCCESS')
  const failedRuns = runs.filter((run) => run.status === 'FAILED')
  const successRate =
    runs.length > 0
      ? Math.round((successfulRuns.length / runs.length) * 100)
      : 0
  const avgDuration =
    runs.length > 0
      ? Math.round(
          runs.reduce((total, run) => {
            const finishedAt = run.finishedAt ?? run.startedAt
            return (
              total +
              (run.durationMs ?? finishedAt.getTime() - run.startedAt.getTime())
            )
          }, 0) / runs.length,
        )
      : 0

  const latestFailedRun = failedRuns[0]
  const latestFailedAutomation = latestFailedRun
    ? workspace.automations.find(
        (automation) => automation.id === latestFailedRun.automationId,
      )
    : null
  const activeAutomations = selectActiveAutomations(workspace.automations)
  const modules = getDashboardModules(capabilities)
  const terminology = getDashboardTerms(capabilities)
  const isSimpleServiceBusiness =
    capabilities?.businessModel ===
    WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
  const taskMetricScope =
    terminology.taskPlural !== 'Tasks' ? 'serviceRequestChildren' : 'all'

  if (capabilities?.commerce.commerceEnabled) {
    return {
      workspaceId: workspace.id,
      workspaceName: `${workspace.name} commerce overview`,
      workspaceSlug: workspace.slug,
      commerceEnabled: true,
      modules,
      terminology,
      taskMetricScope,
      dataMode: 'empty',
      summary:
        'Track products, customers, orders, revenue, and fulfillment activity across this workspace. Your commerce workspace is ready as your operation grows.',
      attention: latestFailedRun
        ? {
            title: 'Automation needs attention',
            workflowName:
              latestFailedAutomation?.name ?? latestFailedRun.automationName,
            issue:
              'A recent workflow run failed and may need review before the next commerce automation runs.',
            time: latestFailedRun.startedAt.toLocaleString(),
            failureHref: `/dashboard/${workspace.slug}/automations/${latestFailedRun.automationId}/runs/${latestFailedRun.id}`,
            workflowHref: `/dashboard/${workspace.slug}/automations/${latestFailedRun.automationId}/builder`,
          }
        : null,
      kpis: [
        {
          id: 'commerceCustomers',
          label: 'Customers',
          value: '0',
          helper: 'No commerce customer records yet.',
          tone: 'cyan',
          href: `/dashboard/${workspace.slug}/customers`,
        },
        {
          id: 'commerceProducts',
          label: 'Products',
          value: '0',
          helper: 'Add products to build your catalog.',
          tone: 'purple',
          href: `/dashboard/${workspace.slug}/products`,
        },
        {
          id: 'commerceOrders',
          label: 'Orders',
          value: '0',
          helper: 'No orders have been created yet.',
          tone: 'slate',
          href: `/dashboard/${workspace.slug}/orders`,
        },
        {
          id: 'commerceRevenue',
          label: 'Revenue',
          value: '$0',
          helper: 'Revenue will appear as orders are recorded.',
          tone: 'emerald',
          href: `/dashboard/${workspace.slug}/analytics?focus=commerce-revenue`,
        },
        {
          id: 'commerceGrossProfit',
          label: 'Gross Profit',
          value: '$0',
          helper:
            'Profitability appears after product costs and shipping costs are set.',
          tone: 'cyan',
          href: `/dashboard/${workspace.slug}/orders`,
        },
        {
          id: 'commerceFulfillment',
          label: 'Fulfillment',
          value: '0',
          helper: 'No fulfillment records yet.',
          tone: 'slate',
          href: `/dashboard/${workspace.slug}/fulfillment`,
        },
        {
          id: 'activeAutomations',
          label: 'Active automations',
          value: activeAutomations.length.toString(),
          helper: 'Workspace workflows',
          tone: 'cyan',
          href: `/dashboard/${workspace.slug}/automations#automations-workspace`,
        },
        {
          id: 'failedRuns',
          label: 'Failed runs',
          value: failedRuns.length.toString(),
          helper: 'Recent execution window',
          tone: failedRuns.length > 0 ? 'rose' : 'emerald',
          href: `/dashboard/${workspace.slug}/executions?view=failed#execution-history`,
        },
      ],
      revenueSeries: [],
      pipelineSeries: [],
      automationSeries: buildRecentRunSeries(runs),
      opportunityStages: [],
      leadSources: [],
      serviceTypes: [],
      serviceRequestStatus: [],
      serviceRequestSchedule: [],
      taskStatus: [],
      recentActivity: runs.slice(0, 6).map((run) => ({
        id: run.id,
        title: run.automationName,
        description:
          run.status === 'FAILED'
            ? 'Workflow run failed and may need attention.'
            : 'Workflow run completed.',
        time: run.startedAt.toLocaleString(),
        status:
          run.status === 'SUCCESS'
            ? 'Success'
            : run.status === 'FAILED'
              ? 'Failed'
              : 'Pending',
        href: `/dashboard/${workspace.slug}/automations/${run.automationId}/runs/${run.id}`,
        executionHref: `/dashboard/${workspace.slug}/executions?view=${
          run.status === 'FAILED' ? 'failed' : 'all'
        }&executionId=${run.id}#execution-history`,
        workflowHref: `/dashboard/${workspace.slug}/automations/${run.automationId}/builder`,
        workflowName: run.automationName,
        startedAt: run.startedAt.toLocaleString(),
        duration: formatDurationMs(run.durationMs),
        trigger: 'Workflow trigger',
        source: 'Workspace execution log',
        errorMessage:
          run.status === 'FAILED'
            ? 'Run failed before completing all configured steps.'
            : undefined,
        steps: run.status === 'SUCCESS' ? 'Completed' : 'Needs review',
      })),
      aiInsights: [
        {
          id: 'commerce-products',
          text: 'Add product details so AI Coach can help organize your catalog.',
          tone: 'blue',
        },
        {
          id: 'commerce-inventory',
          text: 'Configure inventory tracking for low-stock recommendations.',
          tone: 'purple',
        },
        {
          id: 'automation',
          text:
            failedRuns.length > 0
              ? 'A workflow failed in the recent execution window.'
              : 'Automation health is stable across recent runs.',
          tone: failedRuns.length > 0 ? 'red' : 'green',
        },
      ],
      tasksDue: [],
      recentClients: [],
      leads: [],
      followUpLeads: [],
      openServiceRequests: [],
      recentProducts: [],
      productStatusBreakdown: [],
      inventoryHealthBreakdown: [],
      productsByCategory: [],
      automationHealth: {
        successRate: successRate.toString(),
        activeAutomations: activeAutomations.length,
        failedRuns: failedRuns.length,
        avgDuration: avgDuration ? `${avgDuration} ms` : '—',
      },
      revenueInsights: [
        { label: 'Commerce Revenue', value: '$0', tone: 'emerald' },
        { label: 'Orders', value: '0', tone: 'purple' },
        { label: 'Average Order Value', value: '$0', tone: 'cyan' },
        { label: 'Fulfillment Records', value: '0', tone: 'slate' },
      ],
      revenueMonthlyInsights: {},
    }
  }

  const baseClients = createMockWorkspaceClients(workspace.id)
  const tasks = createMockWorkspaceTasks(workspace.id)
  const serviceRequests = createMockServiceRequests(workspace.id)
  const clients = applyWorkspaceClientDerivations(
    baseClients,
    tasks,
    serviceRequests,
  )
  const owners = createDemoWorkspaceOwners(workspace.id)

  const dashboardTaskRecords =
    modules.tasks && taskMetricScope === 'serviceRequestChildren'
      ? tasks.filter((task) => task.parentType === 'serviceRequest')
      : modules.tasks
        ? tasks
        : []
  const dashboardPriorityTasks = getDashboardPriorityTasks(dashboardTaskRecords)
  const dueOrOverdueTasks = getDueOrOverdueOpenTasks(dashboardTaskRecords)
  const openRequests = modules.serviceRequests
    ? getOpenServiceRequests(serviceRequests)
    : []
  const dashboardLeads = modules.leads ? demoLeads : []
  const dashboardOpportunities = modules.opportunities ? demoOpportunities : []
  const newLeads = selectNewLeads(dashboardLeads)
  const followUpLeads = selectLeadsNeedingFollowUp(dashboardLeads)
  const openOpportunities = selectOpenOpportunities(dashboardOpportunities)
  const wonOpportunities = selectWonOpportunities(dashboardOpportunities)
  const lostOpportunities = selectLostOpportunities(dashboardOpportunities)
  // Dashboard KPI counts must stay aligned with the selectors used by the
  // destination page filters, preview drawers, and saved-view tabs.

  const recognizedRevenue = getRecognizedRevenue({
    workspaceId: workspace.id,
    serviceRequests,
  })
  const revenueTotal = centsToDollars(recognizedRevenue.recognizedRevenueCents)
  const revenueSeries: ChartPoint[] = [
    {
      label: 'Jan',
      revenue: 3200,
      previousRevenue: 2800,
      pipeline: 7200,
      leads: 4,
    },
    {
      label: 'Feb',
      revenue: 4100,
      previousRevenue: 3100,
      pipeline: 8600,
      leads: 5,
    },
    {
      label: 'Mar',
      revenue: 5200,
      previousRevenue: 3900,
      pipeline: 10400,
      leads: 7,
    },
    {
      label: 'Apr',
      revenue: 4800,
      previousRevenue: 4600,
      pipeline: 9800,
      leads: 6,
    },
    {
      label: 'May',
      revenue: 6900,
      previousRevenue: 5200,
      pipeline: 12100,
      leads: 8,
    },
    {
      label: 'Jun',
      revenue: revenueTotal,
      previousRevenue: 6200,
      pipeline: openOpportunities.reduce(
        (total, opportunity) => total + opportunity.value,
        0,
      ),
      leads: newLeads.length,
    },
  ]

  const pipelineSeries = revenueSeries.map((point) => ({
    ...point,
    won: point.revenue,
    lost: Math.round((point.pipeline ?? 0) * 0.16),
  }))
  const latestRevenueLabel = revenueSeries[revenueSeries.length - 1]?.label
  const revenueMonthlyInsights = Object.fromEntries(
    revenueSeries.map((point) => {
      const isLatestMonth = point.label === latestRevenueLabel
      const monthOpenOpportunities = isLatestMonth ? openOpportunities : []
      const monthWonOpportunities = isLatestMonth ? wonOpportunities : []
      const monthLostOpportunities = isLatestMonth ? lostOpportunities : []
      const largestForecastDeal = monthOpenOpportunities
        .slice()
        .sort(
          (first, second) =>
            second.value * (second.probability / 100) -
            first.value * (first.probability / 100),
        )[0]

      return [
        point.label,
        modules.opportunities
          ? [
              {
                label: 'Open pipeline',
                value:
                  point.pipeline && point.pipeline > 0
                    ? formatCompactCurrency(point.pipeline)
                    : 'No open pipeline',
                tone: 'purple' as const,
              },
              {
                label: 'Booked value',
                value:
                  point.revenue && point.revenue > 0
                    ? formatCompactCurrency(point.revenue)
                    : 'No won revenue',
                tone: 'emerald' as const,
              },
              {
                label: 'Largest forecast deal',
                value: largestForecastDeal?.name ?? 'No forecast detail',
                tone: 'cyan' as const,
              },
              {
                label: 'Closed mix',
                value: isLatestMonth
                  ? `${monthWonOpportunities.length} won / ${monthLostOpportunities.length} lost`
                  : 'No closed-deal detail',
                tone: 'slate' as const,
              },
            ]
          : [
              {
                label: 'Recognized revenue',
                value:
                  point.revenue && point.revenue > 0
                    ? formatCompactCurrency(point.revenue)
                    : 'No recognized revenue',
                tone: 'emerald' as const,
              },
              {
                label: `${terminology.leadPlural} created`,
                value: String(point.leads ?? 0),
                tone: 'purple' as const,
              },
              {
                label: terminology.serviceRequestPlural,
                value: isLatestMonth
                  ? String(openRequests.length)
                  : 'No current detail',
                tone: 'cyan' as const,
              },
              {
                label: terminology.taskPlural,
                value: isLatestMonth
                  ? String(dueOrOverdueTasks.length)
                  : 'No current detail',
                tone: 'slate' as const,
              },
            ],
      ]
    }),
  )

  const opportunityStages = modules.opportunities
    ? [
        {
          label: 'Discovery Scheduled',
          value: clients
            .filter((client) => client.pipelineStage === 'Onboarding')
            .reduce((total, client) => total + client.opportunity.value, 0),
        },
        {
          label: 'Proposal Sent',
          value: clients
            .filter(
              (client) =>
                client.pipelineStage === 'In Progress' ||
                client.pipelineStage === 'Review / Approval',
            )
            .reduce((total, client) => total + client.opportunity.value, 0),
        },
        {
          label: 'Negotiation',
          value: clients
            .filter((client) => client.pipelineStage === 'Waiting on Client')
            .reduce((total, client) => total + client.opportunity.value, 0),
        },
        {
          label: 'Won',
          value: clients
            .filter((client) => client.pipelineStage === 'Completed')
            .reduce((total, client) => total + client.opportunity.value, 0),
        },
      ].filter((stage) => stage.value > 0)
    : []

  const serviceTypes = serviceRequests.reduce<Record<string, number>>(
    (acc, request) => {
      acc[request.serviceType] = (acc[request.serviceType] ?? 0) + 1
      return acc
    },
    {},
  )

  const serviceRequestStatus = serviceRequests.reduce<Record<string, number>>(
    (acc, request) => {
      acc[request.status] = (acc[request.status] ?? 0) + 1
      return acc
    },
    {},
  )

  const serviceRequestSchedule = serviceRequests.reduce<Record<string, number>>(
    (acc, request) => {
      const label = request.scheduledFor
        ? formatShortDate(new Date(request.scheduledFor))
        : 'Unscheduled'
      acc[label] = (acc[label] ?? 0) + 1
      return acc
    },
    {},
  )

  const taskStatus = dashboardTaskRecords.reduce<Record<string, number>>(
    (acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1
      return acc
    },
    {},
  )

  const defaultDashboardKpis = [
    modules.sales
      ? {
          id: 'sales',
          label: terminology.salesLabel,
          value: formatCompactCents(recognizedRevenue.recognizedRevenueCents),
          helper: 'Recognized from completed work',
          trend: '+12%',
          tone: 'cyan' as const,
          href: `/dashboard/${workspace.slug}/sales-pipeline`,
        }
      : modules.clients
        ? {
            id: 'clients',
            label: `Active ${terminology.customerPlural}`,
            value: clients
              .filter((client) => client.status === 'Active')
              .length.toString(),
            helper: `${formatCompactCents(recognizedRevenue.recognizedRevenueCents)} recognized revenue`,
            tone: 'cyan' as const,
            href: `/dashboard/${workspace.slug}/clients#client-relationships`,
          }
        : null,
    modules.leads
      ? {
          id: 'newLeads',
          label: 'New leads',
          value: newLeads.length.toString(),
          helper: 'New leads needing review',
          trend: `${followUpLeads.length} need follow-up`,
          trendHref: `/dashboard/${workspace.slug}/leads?view=needs-follow-up#leads-workspace`,
          tone: 'purple' as const,
          href: `/dashboard/${workspace.slug}/leads?view=new#leads-workspace`,
        }
      : null,
    modules.opportunities
      ? {
          id: 'openOpportunities',
          label: `Open ${terminology.opportunityPlural.toLowerCase()}`,
          value: openOpportunities.length.toString(),
          helper: formatCompactCurrency(
            openOpportunities.reduce(
              (total, opportunity) => total + opportunity.value,
              0,
            ),
          ),
          tone: 'emerald' as const,
          href: `/dashboard/${workspace.slug}/opportunities?view=open#opportunities-workspace`,
        }
      : null,
    modules.opportunities
      ? {
          id: 'wonOpportunities',
          label: `Won ${terminology.opportunityPlural.toLowerCase()}`,
          value: wonOpportunities.length.toString(),
          helper: 'Fulfillment-ready customers',
          tone: 'slate' as const,
          href: `/dashboard/${workspace.slug}/opportunities?view=closed-won#opportunities-workspace`,
        }
      : null,
    {
      id: 'activeAutomations',
      label: 'Active automations',
      value: activeAutomations.length.toString(),
      helper: 'Workspace workflows',
      tone: 'cyan' as const,
      href: `/dashboard/${workspace.slug}/automations#automations-workspace`,
    },
    {
      id: 'failedRuns',
      label: 'Failed runs',
      value: failedRuns.length.toString(),
      helper: 'Recent execution window',
      tone: failedRuns.length > 0 ? ('rose' as const) : ('emerald' as const),
      href: `/dashboard/${workspace.slug}/executions?view=failed#execution-history`,
    },
    modules.tasks
      ? {
          id: 'tasksDue',
          label: `${terminology.taskPlural} due`,
          value: dueOrOverdueTasks.length.toString(),
          helper: 'Due today or overdue',
          tone: 'amber' as const,
          href: `/dashboard/${workspace.slug}/tasks?view=due-or-overdue#tasks-workspace`,
        }
      : null,
    modules.serviceRequests
      ? {
          id: 'serviceRequests',
          label: terminology.serviceRequestPlural,
          value: openRequests.length.toString(),
          helper: `${getUrgentOpenServiceRequests(openRequests).length} urgent`,
          tone:
            getUrgentOpenServiceRequests(openRequests).length > 0
              ? ('rose' as const)
              : ('slate' as const),
          href: `/dashboard/${workspace.slug}/service-requests?view=open#request-queue`,
        }
      : null,
  ].filter((kpi): kpi is NonNullable<typeof kpi> => Boolean(kpi))

  const dashboardKpis = isSimpleServiceBusiness
    ? [
        ...defaultDashboardKpis
          .filter((kpi) => kpi.id === 'newLeads')
          .map((kpi) => ({
            ...kpi,
            label: 'New Leads',
          })),
        ...defaultDashboardKpis
          .filter((kpi) => kpi.id === 'clients')
          .map((kpi) => ({
            ...kpi,
            label: 'Active Customers',
          })),
        ...defaultDashboardKpis
          .filter((kpi) => kpi.id === 'serviceRequests')
          .map((kpi) => ({
            ...kpi,
            label: 'Jobs',
          })),
        ...defaultDashboardKpis
          .filter((kpi) => kpi.id === 'tasksDue')
          .map((kpi) => ({
            ...kpi,
            label: 'Job Steps',
          })),
        ...defaultDashboardKpis
          .filter((kpi) => kpi.id === 'activeAutomations')
          .map((kpi) => ({
            ...kpi,
            label: 'Active Automations',
          })),
        ...defaultDashboardKpis
          .filter((kpi) => kpi.id === 'failedRuns')
          .map((kpi) => ({
            ...kpi,
            label: 'Failed Runs',
          })),
      ]
    : defaultDashboardKpis

  return {
    workspaceId: workspace.id,
    workspaceName: `${workspace.name} overview`,
    workspaceSlug: workspace.slug,
    modules,
    terminology,
    taskMetricScope,
    dataMode: 'mixed',
    summary:
      "Here's what needs attention and what changed across your business systems.",
    attention: latestFailedRun
      ? {
          title: 'Automation needs attention',
          workflowName:
            latestFailedAutomation?.name ?? latestFailedRun.automationName,
          issue:
            'A recent workflow run failed and may need review before the next customer action.',
          time: latestFailedRun.startedAt.toLocaleString(),
          failureHref: `/dashboard/${workspace.slug}/automations/${latestFailedRun.automationId}/runs/${latestFailedRun.id}`,
          workflowHref: `/dashboard/${workspace.slug}/automations/${latestFailedRun.automationId}/builder`,
        }
      : null,
    kpis: dashboardKpis,
    revenueSeries,
    pipelineSeries,
    automationSeries: buildRecentRunSeries(runs),
    opportunityStages,
    leadSources: modules.leads
      ? [
          { label: 'Website Form', value: 4 },
          { label: 'Referral', value: 2 },
          { label: 'Google Search', value: 2 },
          { label: 'Manual Entry', value: 1 },
        ]
      : [],
    serviceTypes: modules.serviceRequests
      ? Object.entries(serviceTypes).map(([label, value]) => ({
          label,
          value,
        }))
      : [],
    serviceRequestStatus: modules.serviceRequests
      ? Object.entries(serviceRequestStatus).map(([label, value]) => ({
          label,
          value,
        }))
      : [],
    serviceRequestSchedule: modules.serviceRequests
      ? Object.entries(serviceRequestSchedule).map(([label, value]) => ({
          label,
          value,
        }))
      : [],
    taskStatus: modules.tasks
      ? Object.entries(taskStatus).map(([label, value]) => ({
          label,
          value,
        }))
      : [],
    recentActivity: runs.slice(0, 6).map((run) => ({
      id: run.id,
      title: run.automationName,
      description:
        run.status === 'FAILED'
          ? 'Workflow run failed and may need attention.'
          : 'Workflow run completed.',
      time: run.startedAt.toLocaleString(),
      status:
        run.status === 'SUCCESS'
          ? 'Success'
          : run.status === 'FAILED'
            ? 'Failed'
            : 'Pending',
      href: `/dashboard/${workspace.slug}/automations/${run.automationId}/runs/${run.id}`,
      executionHref: `/dashboard/${workspace.slug}/executions?view=${
        run.status === 'FAILED' ? 'failed' : 'all'
      }&executionId=${run.id}#execution-history`,
      workflowHref: `/dashboard/${workspace.slug}/automations/${run.automationId}/builder`,
      workflowName: run.automationName,
      startedAt: run.startedAt.toLocaleString(),
      duration: formatDurationMs(run.durationMs),
      trigger: 'Workflow trigger',
      source: 'Workspace execution log',
      errorMessage:
        run.status === 'FAILED'
          ? 'Run failed before completing all configured steps.'
          : undefined,
      steps: run.status === 'SUCCESS' ? 'Completed' : 'Needs review',
    })),
    aiInsights: [
      modules.leads
        ? {
            id: 'leads',
            text: `${followUpLeads.length} leads have not been followed up with and may need outreach.`,
            tone: 'yellow' as const,
          }
        : null,
      {
        id: 'automation',
        text:
          failedRuns.length > 0
            ? '1 automation failed in the recent execution window.'
            : 'Automation health is stable across recent runs.',
        tone: failedRuns.length > 0 ? ('red' as const) : ('green' as const),
      },
      modules.serviceRequests
        ? {
            id: 'requests',
            text: `${openRequests.length} ${terminology.serviceRequestPlural.toLowerCase()} are open across the workspace.`,
            tone:
              openRequests.length > 3 ? ('yellow' as const) : ('blue' as const),
          }
        : null,
    ].filter((insight): insight is NonNullable<typeof insight> =>
      Boolean(insight),
    ),
    tasksDue: dashboardPriorityTasks.slice(0, 5).map((task) => ({
      id: task.id,
      title: task.title,
      due: task.dueDate,
      owner: getOwnerName(owners, task.ownerId),
      priority: task.priority,
      status: task.status,
      source: task.source,
      relatedRecord: task.relatedRecordLabel,
      description: task.description,
    })),
    recentClients: modules.clients
      ? clients.slice(0, 5).map((client) => ({
          id: client.id,
          name: client.name,
          company: client.company,
          status: client.pipelineStage,
          value: formatRevenueCurrency(
            getCustomerLifetimeValue({
              workspaceId: workspace.id,
              client,
              serviceRequests,
            }),
          ),
          health: client.health,
          openTasks: client.openTasks,
          lastActivity: new Date(client.lastActivity).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: 'numeric',
            },
          ),
          nextAction: client.nextAction,
          nextStepLabel:
            tasks
              .filter(
                (task) =>
                  task.clientId === client.id && task.status !== 'Completed',
              )
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.title ??
            client.nextAction ??
            (client.pipelineStage === 'Waiting on Client'
              ? 'Waiting on client approval'
              : client.pipelineStage === 'Maintenance'
                ? 'Maintenance check-in due'
                : client.status === 'Completed'
                  ? 'No action needed'
                  : client.pipelineStage),
          tags: client.tags,
        }))
      : [],
    leads: dashboardLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      owner: getOwnerName(owners, lead.ownerId),
      value: formatCurrency(lead.value),
      status: lead.status,
      followUpDue: lead.followUpDue,
      followUp: lead.followUpDue
        ? lead.followUpDue === '2026-06-29'
          ? 'Due today'
          : lead.followUpDue < '2026-06-29'
            ? 'Overdue'
            : lead.followUpDue
        : 'Pending outreach',
    })),
    followUpLeads: followUpLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      owner: getOwnerName(owners, lead.ownerId),
      value: formatCurrency(lead.value),
      status: lead.status,
      followUp: lead.followUpDue
        ? lead.followUpDue === '2026-06-29'
          ? 'Due today'
          : lead.followUpDue < '2026-06-29'
            ? 'Overdue'
            : lead.followUpDue
        : 'Pending outreach',
    })),
    openServiceRequests: openRequests.slice(0, 4).map((request) => ({
      id: request.id,
      customer: request.customerName,
      company: request.company,
      priority: request.priority,
      status: request.status,
      scheduled: request.scheduledFor
        ? new Date(request.scheduledFor).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'Not scheduled',
      owner: getOwnerName(owners, request.assignedToOwnerId),
    })),
    automationHealth: {
      successRate: successRate.toString(),
      activeAutomations: activeAutomations.length,
      failedRuns: failedRuns.length,
      avgDuration: avgDuration ? `${avgDuration} ms` : '—',
    },
    revenueInsights: modules.opportunities
      ? [
          {
            label: 'Open pipeline',
            value: formatCompactCurrency(
              openOpportunities.reduce(
                (total, opportunity) => total + opportunity.value,
                0,
              ),
            ),
            tone: 'purple' as const,
          },
          {
            label: 'Booked value',
            value: formatCompactCurrency(
              wonOpportunities.reduce(
                (total, opportunity) => total + opportunity.value,
                0,
              ),
            ),
            tone: 'emerald' as const,
          },
          {
            label: 'Largest forecast deal',
            value:
              openOpportunities
                .slice()
                .sort(
                  (first, second) =>
                    second.value * second.probability -
                    first.value * first.probability,
                )[0]?.name ?? 'No forecast yet',
            tone: 'cyan' as const,
          },
          {
            label: 'Closed mix',
            value: `${wonOpportunities.length} won / ${lostOpportunities.length} lost`,
            tone: 'slate' as const,
          },
        ]
      : [
          {
            label: 'Recognized revenue',
            value: formatCompactCents(recognizedRevenue.recognizedRevenueCents),
            tone: 'emerald' as const,
          },
          {
            label: `Active ${terminology.customerPlural.toLowerCase()}`,
            value: clients
              .filter((client) => client.status === 'Active')
              .length.toString(),
            tone: 'cyan' as const,
          },
          {
            label: `Open ${terminology.serviceRequestPlural.toLowerCase()}`,
            value: openRequests.length.toString(),
            tone: 'purple' as const,
          },
          {
            label: `${terminology.taskPlural} due`,
            value: dueOrOverdueTasks.length.toString(),
            tone: 'slate' as const,
          },
        ],
    revenueMonthlyInsights,
  }
}

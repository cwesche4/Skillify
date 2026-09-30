import { Prisma, type PrismaClient } from '@prisma/client'

import { getFailedAutomationRunsHref } from '@/lib/automations/executionNavigation'
import { prisma } from '@/lib/db'
import { workspaceMemberExecutableJobsWhere } from '@/lib/jobs/jobExecutionAuthorization'
import { activeLeadFollowUpStages } from '@/lib/leads/presentation'
import {
  addDateKeys,
  getStartOfWorkspaceDay,
  getWorkspaceDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

const DASHBOARD_PREVIEW_LIMIT = 3
const TODAY_PREVIEW_LIMIT = 5
const UPCOMING_PREVIEW_LIMIT = 7
const AUTOMATION_FAILURE_WINDOW_DAYS = 7

const activeJobStatuses = [
  'OPEN',
  'SCHEDULED',
  'IN_PROGRESS',
  'WAITING_ON_CLIENT',
] as const

const operationalJobSelect = {
  id: true,
  workspaceId: true,
  title: true,
  customerDisplayName: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  status: true,
  priority: true,
  unableToCompleteReason: true,
  unableToCompleteAt: true,
} satisfies Prisma.JobSelect

const operationalLeadSelect = {
  id: true,
  workspaceId: true,
  displayName: true,
  companyName: true,
  followUpAt: true,
  nextStep: true,
} satisfies Prisma.LeadSelect

const failedRunSelect = {
  id: true,
  workspaceId: true,
  status: true,
  startedAt: true,
  automation: {
    select: {
      id: true,
      name: true,
      simpleAutomationInstallation: { select: { id: true } },
    },
  },
} satisfies Prisma.AutomationRunSelect

type OperationalJobRecord = Prisma.JobGetPayload<{
  select: typeof operationalJobSelect
}>
type OperationalLeadRecord = Prisma.LeadGetPayload<{
  select: typeof operationalLeadSelect
}>
type FailedRunRecord = Prisma.AutomationRunGetPayload<{
  select: typeof failedRunSelect
}>

export type OperationalDashboardJob = {
  id: string
  title: string
  customerDisplayName: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  status: string
  priority: string
  unableToCompleteReason: string | null
  unableToCompleteAt: string | null
}

export type OperationalDashboardLead = {
  id: string
  displayName: string
  companyName: string | null
  followUpAt: string
  nextStep: string | null
}

export type OperationalDashboardFailure = {
  id: string
  automationName: string
  managedBySimple: boolean
  startedAt: string
}

type TodayWork = {
  jobsCount: number
  jobs: OperationalDashboardJob[]
}

type DashboardBase = {
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  timezone: string
  todayDateKey: string
  today: TodayWork
  upcomingJobs: OperationalDashboardJob[]
}

export type OperationalDashboardData =
  | (DashboardBase & {
      mode: 'management'
      attention: {
        unableJobsCount: number
        unableJobs: OperationalDashboardJob[]
        overdueLeadsCount: number
        overdueLeads: OperationalDashboardLead[]
        failedAutomationsCount: number
        failedAutomations: OperationalDashboardFailure[]
        failedAutomationsHref: string
        failureWindowDays: number
      }
      today: TodayWork & {
        leadsCount: number
        leads: OperationalDashboardLead[]
      }
    })
  | (DashboardBase & { mode: 'member' })

type OperationalDashboardDb = Pick<
  PrismaClient,
  'job' | 'lead' | 'automationRun'
>

function mapJob(record: OperationalJobRecord): OperationalDashboardJob {
  return {
    id: record.id,
    title: record.title,
    customerDisplayName: record.customerDisplayName,
    scheduledStartAt: record.scheduledStartAt?.toISOString() ?? null,
    scheduledEndAt: record.scheduledEndAt?.toISOString() ?? null,
    status: record.status,
    priority: record.priority,
    unableToCompleteReason: record.unableToCompleteReason,
    unableToCompleteAt: record.unableToCompleteAt?.toISOString() ?? null,
  }
}

function mapLead(record: OperationalLeadRecord): OperationalDashboardLead {
  return {
    id: record.id,
    displayName: record.displayName,
    companyName: record.companyName,
    followUpAt: record.followUpAt!.toISOString(),
    nextStep: record.nextStep,
  }
}

function mapFailure(record: FailedRunRecord): OperationalDashboardFailure {
  return {
    id: record.id,
    automationName: record.automation.name,
    managedBySimple: Boolean(record.automation.simpleAutomationInstallation),
    startedAt: record.startedAt.toISOString(),
  }
}

export function getOperationalDashboardDateBounds(input: {
  now: Date
  timezone: string
}) {
  const todayDateKey = getWorkspaceDateKey(input.now, input.timezone)
  const tomorrowDateKey = addDateKeys(todayDateKey, 1)
  return {
    todayDateKey,
    todayStart: getStartOfWorkspaceDay(todayDateKey, input.timezone),
    tomorrowStart: getStartOfWorkspaceDay(tomorrowDateKey, input.timezone),
  }
}

function jobScheduleWhere(input: {
  start: Date
  end?: Date
}): Prisma.JobWhereInput {
  return {
    archivedAt: null,
    status: { in: [...activeJobStatuses] },
    scheduledStartAt: {
      gte: input.start,
      ...(input.end ? { lt: input.end } : {}),
    },
  }
}

function activeLeadWhere(): Prisma.LeadWhereInput {
  return {
    archivedAt: null,
    convertedCustomerId: null,
    stage: { in: [...activeLeadFollowUpStages] },
    followUpAt: { not: null },
  }
}

export async function loadOperationalDashboard(
  input: {
    workspaceId: string
    workspaceSlug: string
    workspaceName: string
    workspaceMemberId: string
    role: unknown
    timezone: string
    now?: Date
  },
  db: OperationalDashboardDb = prisma,
): Promise<OperationalDashboardData> {
  const now = input.now ?? new Date()
  const { todayDateKey, todayStart, tomorrowStart } =
    getOperationalDashboardDateBounds({ now, timezone: input.timezone })
  const base = {
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceName: input.workspaceName,
    timezone: input.timezone,
    todayDateKey,
  }

  if (!canManageOperations(input.role)) {
    const memberWhere = workspaceMemberExecutableJobsWhere({
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
    })
    const todayWhere: Prisma.JobWhereInput = {
      AND: [
        memberWhere,
        jobScheduleWhere({ start: todayStart, end: tomorrowStart }),
      ],
    }
    const upcomingWhere: Prisma.JobWhereInput = {
      AND: [memberWhere, jobScheduleWhere({ start: tomorrowStart })],
    }
    const [jobsCount, jobs, upcomingJobs] = await Promise.all([
      db.job.count({ where: todayWhere }),
      db.job.findMany({
        where: todayWhere,
        select: operationalJobSelect,
        orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
        take: TODAY_PREVIEW_LIMIT,
      }),
      db.job.findMany({
        where: upcomingWhere,
        select: operationalJobSelect,
        orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
        take: UPCOMING_PREVIEW_LIMIT,
      }),
    ])
    return {
      ...base,
      mode: 'member',
      today: {
        jobsCount,
        jobs: jobs
          .filter((job) => job.workspaceId === input.workspaceId)
          .map(mapJob),
      },
      upcomingJobs: upcomingJobs
        .filter((job) => job.workspaceId === input.workspaceId)
        .map(mapJob),
    }
  }

  const workspaceWhere = { workspaceId: input.workspaceId }
  const unableWhere: Prisma.JobWhereInput = {
    ...workspaceWhere,
    archivedAt: null,
    status: 'UNABLE_TO_COMPLETE',
  }
  const todayJobsWhere: Prisma.JobWhereInput = {
    ...workspaceWhere,
    ...jobScheduleWhere({ start: todayStart, end: tomorrowStart }),
  }
  const upcomingJobsWhere: Prisma.JobWhereInput = {
    ...workspaceWhere,
    ...jobScheduleWhere({ start: tomorrowStart }),
  }
  const overdueLeadsWhere: Prisma.LeadWhereInput = {
    ...workspaceWhere,
    ...activeLeadWhere(),
    followUpAt: { lt: todayStart },
  }
  const todayLeadsWhere: Prisma.LeadWhereInput = {
    ...workspaceWhere,
    ...activeLeadWhere(),
    followUpAt: { gte: todayStart, lt: tomorrowStart },
  }
  const failureSince = new Date(
    now.getTime() - AUTOMATION_FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )
  const failedRunsWhere: Prisma.AutomationRunWhereInput = {
    ...workspaceWhere,
    status: 'FAILED',
    startedAt: { gte: failureSince, lte: now },
    automation: { is: { workspaceId: input.workspaceId } },
  }

  const [
    unableJobsCount,
    unableJobs,
    overdueLeadsCount,
    overdueLeads,
    failedAutomationsCount,
    failedAutomations,
    todayJobsCount,
    todayJobs,
    todayLeadsCount,
    todayLeads,
    upcomingJobs,
  ] = await Promise.all([
    db.job.count({ where: unableWhere }),
    db.job.findMany({
      where: unableWhere,
      select: operationalJobSelect,
      orderBy: [{ unableToCompleteAt: 'desc' }, { id: 'asc' }],
      take: DASHBOARD_PREVIEW_LIMIT,
    }),
    db.lead.count({ where: overdueLeadsWhere }),
    db.lead.findMany({
      where: overdueLeadsWhere,
      select: operationalLeadSelect,
      orderBy: [{ followUpAt: 'asc' }, { id: 'asc' }],
      take: DASHBOARD_PREVIEW_LIMIT,
    }),
    db.automationRun.count({ where: failedRunsWhere }),
    db.automationRun.findMany({
      where: failedRunsWhere,
      select: failedRunSelect,
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      take: DASHBOARD_PREVIEW_LIMIT,
    }),
    db.job.count({ where: todayJobsWhere }),
    db.job.findMany({
      where: todayJobsWhere,
      select: operationalJobSelect,
      orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
      take: TODAY_PREVIEW_LIMIT,
    }),
    db.lead.count({ where: todayLeadsWhere }),
    db.lead.findMany({
      where: todayLeadsWhere,
      select: operationalLeadSelect,
      orderBy: [{ followUpAt: 'asc' }, { id: 'asc' }],
      take: TODAY_PREVIEW_LIMIT,
    }),
    db.job.findMany({
      where: upcomingJobsWhere,
      select: operationalJobSelect,
      orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
      take: UPCOMING_PREVIEW_LIMIT,
    }),
  ])

  const scopedFailures = failedAutomations.filter(
    (run) => run.workspaceId === input.workspaceId,
  )
  const failedAutomationViews = scopedFailures.map(mapFailure)
  return {
    ...base,
    mode: 'management',
    attention: {
      unableJobsCount,
      unableJobs: unableJobs
        .filter((job) => job.workspaceId === input.workspaceId)
        .map(mapJob),
      overdueLeadsCount,
      overdueLeads: overdueLeads
        .filter((lead) => lead.workspaceId === input.workspaceId)
        .map(mapLead),
      failedAutomationsCount,
      failedAutomations: failedAutomationViews,
      failedAutomationsHref: getFailedAutomationRunsHref(
        input.workspaceSlug,
        failedAutomationViews,
      ),
      failureWindowDays: AUTOMATION_FAILURE_WINDOW_DAYS,
    },
    today: {
      jobsCount: todayJobsCount,
      jobs: todayJobs
        .filter((job) => job.workspaceId === input.workspaceId)
        .map(mapJob),
      leadsCount: todayLeadsCount,
      leads: todayLeads
        .filter((lead) => lead.workspaceId === input.workspaceId)
        .map(mapLead),
    },
    upcomingJobs: upcomingJobs
      .filter((job) => job.workspaceId === input.workspaceId)
      .map(mapJob),
  }
}

import React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/PageHeader'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { getAutomationExecutionHref } from '@/lib/automations/executionNavigation'
import type {
  OperationalDashboardData,
  OperationalDashboardJob,
  OperationalDashboardLead,
} from '@/lib/dashboard/operationalDashboard'
import { jobStatusLabels, priorityLabels } from '@/lib/jobs/presentation'
import { leadStageLabels } from '@/lib/leads/presentation'
import type {
  JobStatus,
  LeadStage,
  OperationsPriority,
} from '@/lib/prisma/enums'
import { formatInWorkspaceTimezone } from '@/lib/scheduling/schedulingDateTime'
import { cn } from '@/lib/utils'

const actionLinkClass =
  'focus-visible:ring-brand-primary/70 border-app bg-app-surface-raised text-app-primary hover:bg-app-surface-hover inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2'

function dashboardDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00.000Z`))
}

function formatSchedule(iso: string | null, timezone: string) {
  if (!iso) return 'Time not set'
  return formatInWorkspaceTimezone(iso, timezone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function humanize(value: string | null) {
  if (!value) return 'Reason not provided'
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function jobStatusVariant(status: string): BadgeVariant {
  if (status === 'UNABLE_TO_COMPLETE') return 'red'
  if (status === 'WAITING_ON_CLIENT') return 'yellow'
  if (status === 'IN_PROGRESS') return 'blue'
  return 'slate'
}

function jobStatusLabel(status: string) {
  return jobStatusLabels[status as JobStatus] ?? humanize(status)
}

function priorityLabel(priority: string) {
  return priorityLabels[priority as OperationsPriority] ?? humanize(priority)
}

function leadStageLabel(stage: string) {
  return leadStageLabels[stage as LeadStage] ?? humanize(stage)
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="border-app bg-app-surface-muted text-app-secondary rounded-xl border border-dashed px-4 py-5 text-center text-sm">
      {children}
    </div>
  )
}

function RowLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="border-app hover:bg-app-surface-hover focus-visible:ring-brand-primary/70 flex items-start justify-between gap-3 rounded-xl border px-3 py-3 transition-colors focus:outline-none focus-visible:ring-2"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ArrowRight className="text-app-tertiary mt-0.5 h-4 w-4 shrink-0" />
    </Link>
  )
}

function JobRow({
  job,
  workspaceSlug,
  timezone,
  showUnableReason = false,
}: {
  job: OperationalDashboardJob
  workspaceSlug: string
  timezone: string
  showUnableReason?: boolean
}) {
  const schedule = formatSchedule(job.scheduledStartAt, timezone)
  const assignment = job.assignmentLabel ?? 'Unassigned'
  const unableDetails = [
    humanize(job.unableToCompleteReason),
    job.unableToCompleteAt
      ? `Reported ${formatSchedule(job.unableToCompleteAt, timezone)}`
      : null,
    job.unableToCompleteReporter ? `by ${job.unableToCompleteReporter}` : null,
  ].filter(Boolean)

  return (
    <RowLink
      href={`/dashboard/${workspaceSlug}/service-requests?jobId=${encodeURIComponent(job.id)}#request-queue`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <p className="text-app-primary truncate text-sm font-medium">
          {job.title}
        </p>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge variant={jobStatusVariant(job.status)} size="xs">
            {jobStatusLabel(job.status)}
          </Badge>
          <Badge
            variant={
              job.priority === 'URGENT'
                ? 'red'
                : job.priority === 'HIGH'
                  ? 'orange'
                  : 'slate'
            }
            size="xs"
          >
            {priorityLabel(job.priority)}
          </Badge>
          {job.recurringVisit ? (
            <Badge variant="purple" size="xs">
              Recurring visit
            </Badge>
          ) : null}
          {job.startTimePassed ? (
            <Badge variant="orange" size="xs">
              Start time passed
            </Badge>
          ) : null}
          {job.previouslyUnable ? (
            <Badge variant="yellow" size="xs">
              Previously unable
            </Badge>
          ) : null}
          {job.isUnassigned ? (
            <Badge variant="orange" size="xs">
              Unassigned
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="text-app-secondary mt-1 truncate text-xs">
        {[schedule, job.customerDisplayName ?? 'Customer not linked'].join(
          ' · ',
        )}
      </p>
      <p className="text-app-tertiary mt-1 truncate text-xs">
        {showUnableReason
          ? [job.serviceLocationSnapshot, assignment, ...unableDetails]
              .filter(Boolean)
              .join(' · ')
          : [assignment, job.serviceLocationSnapshot]
              .filter(Boolean)
              .join(' · ')}
      </p>
    </RowLink>
  )
}

function LeadRow({
  lead,
  workspaceSlug,
  timezone,
  view,
}: {
  lead: OperationalDashboardLead
  workspaceSlug: string
  timezone: string
  view: 'overdue' | 'due-today'
}) {
  const followUpLabel = formatInWorkspaceTimezone(lead.followUpAt, timezone, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const overdueLabel = lead.overdueCalendarDays
    ? countLabel(lead.overdueCalendarDays, 'day overdue', 'days overdue')
    : null

  return (
    <RowLink
      href={`/dashboard/${workspaceSlug}/leads?view=${view}&leadId=${encodeURIComponent(lead.id)}#leads-workspace`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="text-app-primary truncate text-sm font-medium">
          {lead.displayName}
        </p>
        <Badge variant="blue" size="xs">
          {leadStageLabel(lead.stage)}
        </Badge>
      </div>
      <p className="text-app-secondary mt-1 truncate text-xs">
        {[lead.companyName, lead.assigneeDisplayName ?? 'Unassigned']
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="text-app-tertiary mt-1 truncate text-xs">
        {[
          lead.nextStep ? `Next: ${lead.nextStep}` : 'Follow-up needed',
          followUpLabel,
          overdueLabel,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </RowLink>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-app-primary text-lg font-semibold">{title}</h2>
      <p className="text-app-secondary mt-1 text-sm">{description}</p>
    </div>
  )
}

function CountTitle({
  label,
  count,
  attention = false,
}: {
  label: string
  count: number
  attention?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <CardTitle>{label}</CardTitle>
      <Badge variant={attention ? (count ? 'orange' : 'green') : 'blue'}>
        {count}
      </Badge>
    </div>
  )
}

export function OperationalDashboard({
  data,
}: {
  data: OperationalDashboardData
}) {
  const jobsHref = `/dashboard/${data.workspaceSlug}/service-requests`
  const schedulingHref = `/dashboard/${data.workspaceSlug}/scheduling`
  const leadsHref = `/dashboard/${data.workspaceSlug}/leads`
  const waitingJobsHref = `${jobsHref}?view=waiting#request-queue`
  const isManagement = data.mode === 'management'
  const attentionCount = isManagement
    ? data.attention.unableJobsCount +
      data.attention.overdueLeadsCount +
      data.attention.failedAutomationsCount
    : 0

  return (
    <div className="space-y-8" data-testid="operational-dashboard">
      <PageHeader
        title={isManagement ? 'Operations overview' : 'My work'}
        description={`${dashboardDateLabel(data.todayDateKey)} · Times shown in ${data.timezone}`}
        actions={
          <>
            {isManagement ? (
              <Link href={leadsHref} className={actionLinkClass}>
                <Users className="h-4 w-4" /> Leads
              </Link>
            ) : null}
            <Link href={jobsHref} className={actionLinkClass}>
              <BriefcaseBusiness className="h-4 w-4" /> Jobs
            </Link>
            <Link href={schedulingHref} className={actionLinkClass}>
              <CalendarDays className="h-4 w-4" /> Scheduling
            </Link>
          </>
        }
      />

      <nav
        aria-label={isManagement ? 'Operational summary' : 'Work summary'}
        className="border-app bg-app-surface-muted rounded-xl border px-4 py-3"
      >
        {data.mode === 'management' ? (
          <ul className="text-app-secondary flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <li className="text-app-primary font-medium">
              {countLabel(attentionCount, 'item needs', 'items need')} attention
            </li>
            <li aria-hidden="true">·</li>
            <li>
              {data.waitingOnClientCount > 0 ? (
                <Link
                  href={waitingJobsHref}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {countLabel(
                    data.waitingOnClientCount,
                    'Job waiting on client',
                    'Jobs waiting on client',
                  )}
                </Link>
              ) : (
                '0 Jobs waiting on client'
              )}
            </li>
            <li aria-hidden="true">·</li>
            <li>
              {data.today.jobsCount > 0 ? (
                <Link
                  href={schedulingHref}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {countLabel(data.today.jobsCount, 'Job today', 'Jobs today')}
                </Link>
              ) : (
                '0 Jobs today'
              )}
            </li>
            <li aria-hidden="true">·</li>
            <li>
              {data.today.leadsCount > 0 ? (
                <Link
                  href={`${leadsHref}?view=due-today#leads-workspace`}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {countLabel(
                    data.today.leadsCount,
                    'follow-up due today',
                    'follow-ups due today',
                  )}
                </Link>
              ) : (
                '0 follow-ups due today'
              )}
            </li>
          </ul>
        ) : (
          <p className="text-app-secondary text-sm">
            <span className="text-app-primary font-medium">
              {countLabel(
                data.today.jobsCount,
                'assigned Job today',
                'assigned Jobs today',
              )}
            </span>
            {data.upcomingJobs.length
              ? ` · Next ${data.upcomingJobs.length} upcoming shown`
              : ' · No upcoming assigned Jobs'}
          </p>
        )}
      </nav>

      {isManagement ? (
        <section className="space-y-4" aria-labelledby="attention-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div id="attention-heading">
              <SectionHeading
                title="Needs your attention"
                description="Operational exceptions that may need a decision or follow-up."
              />
            </div>
          </div>

          {attentionCount === 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <div>
                    <p className="text-app-primary text-sm font-medium">
                      No current attention items found
                    </p>
                    <p className="text-app-secondary mt-1 text-sm">
                      No Unable Jobs, overdue Lead follow-ups, or recent
                      Automation failures were found.
                    </p>
                  </div>
                </div>
                <Link href={schedulingHref} className={actionLinkClass}>
                  Open Scheduling <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CountTitle
                    label="Unable to complete"
                    count={data.attention.unableJobsCount}
                    attention
                  />
                  <CardDescription>
                    Jobs reported from the field that need review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.attention.unableJobs.length ? (
                    data.attention.unableJobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        workspaceSlug={data.workspaceSlug}
                        timezone={data.timezone}
                        showUnableReason
                      />
                    ))
                  ) : (
                    <EmptyState>No unable Jobs.</EmptyState>
                  )}
                  <Link
                    href={`${jobsHref}?view=needs-attention#request-queue`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                  >
                    Review Jobs <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CountTitle
                    label="Overdue lead follow-ups"
                    count={data.attention.overdueLeadsCount}
                    attention
                  />
                  <CardDescription>
                    Active Leads with a follow-up date before today.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.attention.overdueLeads.length ? (
                    data.attention.overdueLeads.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        workspaceSlug={data.workspaceSlug}
                        timezone={data.timezone}
                        view="overdue"
                      />
                    ))
                  ) : (
                    <EmptyState>No overdue follow-ups.</EmptyState>
                  )}
                  <Link
                    href={`${leadsHref}?view=overdue#leads-workspace`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                  >
                    Review Leads <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CountTitle
                    label="Automation failures"
                    count={data.attention.failedAutomationsCount}
                    attention
                  />
                  <CardDescription>
                    Failed executions from the last{' '}
                    {data.attention.failureWindowDays} days.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.attention.failedAutomations.length ? (
                    data.attention.failedAutomations.map((failure) => (
                      <RowLink
                        key={failure.id}
                        href={getAutomationExecutionHref(data.workspaceSlug, {
                          id: failure.id,
                          status: 'FAILED',
                          managedBySimple: failure.managedBySimple,
                        })}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-app-primary truncate text-sm font-medium">
                            {failure.automationName}
                          </p>
                          <Badge
                            variant={
                              failure.managedBySimple ? 'brand' : 'purple'
                            }
                            size="xs"
                          >
                            {failure.managedBySimple ? 'Simple' : 'Advanced'}
                          </Badge>
                        </div>
                        <p className="text-app-tertiary mt-1 text-xs">
                          {formatSchedule(failure.startedAt, data.timezone)}
                        </p>
                      </RowLink>
                    ))
                  ) : (
                    <EmptyState>No recent failures.</EmptyState>
                  )}
                  <Link
                    href={data.attention.failedAutomationsHref}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                  >
                    Review Automations <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="today-heading">
        <div id="today-heading">
          <SectionHeading
            title={isManagement ? 'Today' : 'My work today'}
            description={
              isManagement
                ? 'Scheduled field work and Lead follow-ups due today.'
                : 'Jobs currently assigned to you or one of your active Teams.'
            }
          />
        </div>
        <div
          className={cn(
            'grid gap-4',
            isManagement ? 'lg:grid-cols-2' : 'grid-cols-1',
          )}
        >
          <Card>
            <CardHeader>
              <CountTitle label="Scheduled Jobs" count={data.today.jobsCount} />
              <CardDescription>
                Ordered by scheduled start time in the workspace timezone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.today.jobs.length ? (
                data.today.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    workspaceSlug={data.workspaceSlug}
                    timezone={data.timezone}
                  />
                ))
              ) : (
                <EmptyState>No scheduled Jobs today.</EmptyState>
              )}
              <Link
                href={data.today.jobs.length ? jobsHref : schedulingHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              >
                {data.today.jobs.length ? 'View Jobs' : 'Open Scheduling'}{' '}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {data.mode === 'management' ? (
            <Card>
              <CardHeader>
                <CountTitle
                  label="Lead follow-ups due"
                  count={data.today.leadsCount}
                />
                <CardDescription>
                  Active Leads with a follow-up scheduled for today.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.today.leads.length ? (
                  data.today.leads.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      workspaceSlug={data.workspaceSlug}
                      timezone={data.timezone}
                      view="due-today"
                    />
                  ))
                ) : (
                  <EmptyState>No Lead follow-ups due today.</EmptyState>
                )}
                <Link
                  href={`${leadsHref}?view=due-today#leads-workspace`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  View Leads <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="upcoming-heading">
        <div id="upcoming-heading">
          <SectionHeading
            title="Upcoming"
            description={
              isManagement
                ? 'The next seven scheduled Jobs after today.'
                : 'Your next seven assigned Jobs after today.'
            }
          />
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-brand-primary" />
              <CardTitle>Next scheduled Jobs</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.upcomingJobs.length ? (
              data.upcomingJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  workspaceSlug={data.workspaceSlug}
                  timezone={data.timezone}
                />
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyState>No upcoming scheduled Jobs.</EmptyState>
                <Link
                  href={schedulingHref}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  Open Scheduling <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {isManagement && attentionCount > 0 ? (
        <div className="sr-only" role="status">
          <AlertTriangle /> {attentionCount} operational items need attention.
        </div>
      ) : null}
    </div>
  )
}

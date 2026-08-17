import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SetupStatusBadge } from '@/components/workspaces/SetupStatusBadge'
import { prisma } from '@/lib/db'
import {
  type ReadinessIssue,
  type ReadinessStatus,
  resolveWorkspaceReadiness,
} from '@/lib/readiness/workspaceReadiness'
import {
  normalizeWorkspaceSetupProgress,
  workspaceSetupSteps,
  type WorkspaceSetupProgress,
  type WorkspaceSetupStepStatus,
} from '@/lib/workspaces/workspaceSetup'
import { cn } from '@/lib/utils'

type SetupReadinessPageProps = {
  params: { workspaceSlug: string }
}

export default async function WorkspaceSetupReadinessPage({
  params,
}: SetupReadinessPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: true,
      integrationConnections: true,
    },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <EmptyState
          title="Workspace not found"
          description="The requested workspace could not be loaded."
        />
      </DashboardShell>
    )
  }

  const membership = workspace.members.find(
    (member) => member.userId === profile.id,
  )
  if (!membership) {
    return (
      <DashboardShell>
        <EmptyState
          title="Access denied"
          description="You are not a member of this workspace."
        />
      </DashboardShell>
    )
  }

  const readiness = resolveWorkspaceReadiness({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    businessInformationComplete: true,
    validWorkingHoursExist: false,
    ownerAccessValid: workspace.members.some(
      (member) => member.role === 'OWNER',
    ),
    memberCount: workspace.members.length,
    calendarConnections: workspace.integrationConnections as any,
    notificationChannelsConfigured: false,
    manualLeadCreationAvailable: true,
    automatedLeadSourceConfigured: false,
    workspaceAiConfigured: false,
    workflowBuilderAvailable: true,
  })
  const setupPath = `/dashboard/${workspace.slug}/settings/setup`
  const setupProgress = getSetupProgressFromReadiness({
    validWorkingHoursExist: false,
    notificationChannelsConfigured: false,
    automatedLeadSourceConfigured: false,
    externalCalendarConnected: workspace.integrationConnections.some(
      (connection) =>
        connection.category === 'calendar' && connection.status === 'connected',
    ),
    memberCount: workspace.members.length,
  })
  const issueCounts = readiness.issues.reduce(
    (counts, issue) => {
      if (issue.severity === 'blocking' || issue.severity === 'error') {
        counts.required += 1
      } else {
        counts.optional += 1
      }
      return counts
    },
    { required: 0, optional: 0 },
  )

  return (
    <DashboardShell>
      <PageHeader
        title="Workspace Setup & Readiness"
        description="Review onboarding, required configuration, and workspace readiness without reopening the full setup flow automatically."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-100">
                Readiness
              </h2>
              <ReadinessStatusBadge status={readiness.status} />
            </div>
            <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
              {issueCounts.required > 0
                ? `${issueCounts.required} required item${issueCounts.required === 1 ? '' : 's'} need attention.`
                : 'Required setup is not blocked.'}{' '}
              {issueCounts.optional > 0
                ? `${issueCounts.optional} optional recommendation${issueCounts.optional === 1 ? '' : 's'} remain.`
                : 'No optional recommendations remain.'}
            </p>
          </div>

          <div className="space-y-2">
            {readiness.issues.length ? (
              readiness.issues.map((issue) => (
                <div
                  key={issue.code}
                  className={cn(
                    'rounded-xl border bg-slate-950/45 p-3',
                    issue.severity === 'blocking' || issue.severity === 'error'
                      ? 'border-amber-300/25'
                      : 'border-slate-800',
                  )}
                >
                  <p className="text-sm font-medium text-neutral-100">
                    {issue.title}
                  </p>
                  <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
                    {issue.message}
                  </p>
                  {issue.destination ? (
                    <Link
                      href={getSettingsIssueDestination(issue, setupPath)}
                      className="mt-2 inline-flex text-xs font-medium text-cyan-100 underline decoration-cyan-100/30 underline-offset-2"
                    >
                      Review item
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-neutral-text-secondary text-sm">
                No readiness issues found.
              </p>
            )}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold text-neutral-100">
            Setup Steps
          </h2>
          <p className="text-neutral-text-secondary text-xs leading-5">
            Open the guided setup at a specific step when you need to update
            onboarding configuration.
          </p>
          <div className="space-y-2">
            {workspaceSetupSteps.map((step) => (
              <Link
                key={step.id}
                href={`${setupPath}?setup=1&setupStep=${step.id}`}
                className={cn(
                  'block rounded-xl border bg-slate-950/45 px-3 py-2 text-sm text-neutral-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.045] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                  setupStepAccent(setupProgress[step.id]),
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{step.title}</span>
                  <SetupStatusBadge
                    status={setupProgress[step.id]}
                    className="shrink-0"
                  />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}

function getSetupProgressFromReadiness({
  validWorkingHoursExist,
  notificationChannelsConfigured,
  automatedLeadSourceConfigured,
  externalCalendarConnected,
  memberCount,
}: {
  validWorkingHoursExist: boolean
  notificationChannelsConfigured: boolean
  automatedLeadSourceConfigured: boolean
  externalCalendarConnected: boolean
  memberCount: number
}): WorkspaceSetupProgress {
  return normalizeWorkspaceSetupProgress({
    business: 'complete',
    workingHours: validWorkingHoursExist ? 'complete' : 'actionRequired',
    members: memberCount > 1 ? 'complete' : 'inProgress',
    structure: 'notStarted',
    calendars: externalCalendarConnected ? 'complete' : 'notStarted',
    ai: 'notStarted',
    leadIntake: automatedLeadSourceConfigured ? 'complete' : 'notStarted',
    notifications: notificationChannelsConfigured
      ? 'complete'
      : 'actionRequired',
    review: 'notStarted',
  })
}

function getSettingsIssueDestination(issue: ReadinessIssue, setupPath: string) {
  if (!issue.destination) return setupPath
  const marker = '?setup=1'
  if (issue.destination.includes(marker)) {
    const params = new URLSearchParams(issue.destination.split('?')[1] ?? '')
    const setupStep = params.get('setupStep')
    return setupStep ? `${setupPath}?setup=1&setupStep=${setupStep}` : setupPath
  }
  return issue.destination
}

function setupStepAccent(status: WorkspaceSetupStepStatus) {
  if (status === 'complete') return 'border-emerald-300/20'
  if (status === 'actionRequired' || status === 'configurationRequired') {
    return 'border-amber-300/25'
  }
  if (status === 'connectionError') return 'border-rose-300/25'
  if (status === 'inProgress') return 'border-sky-300/20'
  return 'border-slate-800'
}

function ReadinessStatusBadge({ status }: { status: ReadinessStatus }) {
  const label =
    status === 'ready'
      ? 'Ready'
      : status === 'readyWithWarnings'
        ? 'Ready with warnings'
        : status === 'blocked'
          ? 'Blocked'
          : 'Needs attention'
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.08em]',
        status === 'ready'
          ? 'bg-emerald-300/12 border-emerald-300/35 text-emerald-100'
          : status === 'blocked'
            ? 'bg-amber-300/12 border-amber-300/40 text-amber-100'
            : 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
      )}
    >
      {label}
    </span>
  )
}

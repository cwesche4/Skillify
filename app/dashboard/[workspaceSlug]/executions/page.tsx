import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ExecutionsClient } from '@/components/dashboard/executions/ExecutionsClient'
import { prisma } from '@/lib/db'
import type { ExecutionStatus, WorkflowExecution } from '@/lib/executions/types'

type PageProps = {
  params: { workspaceSlug: string }
}

const statusMap: Record<string, ExecutionStatus> = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  RUNNING: 'running',
}

const mockExecutions: WorkflowExecution[] = [
  {
    id: 'preview-missed-call-1205',
    workspaceId: 'preview',
    workflowId: 'preview-missed-call',
    workflowName: 'Missed Call -> SMS Follow-up',
    status: 'success',
    trigger: 'Missed call',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4 + 1200).toISOString(),
    durationMs: 1200,
    stepsTotal: 5,
    stepsCompleted: 5,
    errorMessage: null,
    logs: [
      'Trigger received',
      'Contact found',
      'SMS prepared',
      'SMS sent',
      'Completed',
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    isMock: true,
  },
  {
    id: 'preview-review-request-1305',
    workspaceId: 'preview',
    workflowId: 'preview-review-request',
    workflowName: 'Review Request',
    status: 'success',
    trigger: 'Job completed',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 3 + 1100).toISOString(),
    durationMs: 1100,
    stepsTotal: 4,
    stepsCompleted: 4,
    errorMessage: null,
    logs: [
      'Trigger received',
      'Client matched',
      'Review request prepared',
      'Review request sent',
      'Completed',
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    isMock: true,
  },
  {
    id: 'preview-lead-follow-up-1405',
    workspaceId: 'preview',
    workflowId: 'preview-lead-follow-up',
    workflowName: 'Lead Follow-up',
    status: 'failed',
    trigger: 'Form submission',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 900).toISOString(),
    durationMs: 900,
    stepsTotal: 4,
    stepsCompleted: 2,
    errorMessage: 'Missing phone number',
    logs: [
      'Trigger received',
      'Contact lookup',
      'Missing phone number',
      'Failed',
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isMock: true,
  },
  {
    id: 'preview-client-onboarding-1505',
    workspaceId: 'preview',
    workflowId: 'preview-client-onboarding',
    workflowName: 'Client Onboarding',
    status: 'success',
    trigger: 'Manual run',
    startedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 60 + 1300).toISOString(),
    durationMs: 1300,
    stepsTotal: 5,
    stepsCompleted: 5,
    errorMessage: null,
    logs: [
      'Trigger received',
      'Client record created',
      'Welcome task created',
      'Onboarding email sent',
      'Completed',
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    isMock: true,
  },
  {
    id: 'preview-weekly-summary',
    workspaceId: 'preview',
    workflowId: 'preview-summary',
    workflowName: 'Weekly Summary',
    status: 'success',
    trigger: 'Schedule',
    startedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 20 + 1800).toISOString(),
    durationMs: 1800,
    stepsTotal: 4,
    stepsCompleted: 4,
    errorMessage: null,
    logs: [
      'Trigger received',
      'Metrics collected',
      'Summary generated',
      'Task created',
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    isMock: true,
  },
]

export default async function ExecutionsPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        select: {
          userId: true,
        },
      },
      automations: {
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      },
      automationRuns: {
        orderBy: { startedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          workspaceId: true,
          automationId: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          log: true,
          events: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              status: true,
              message: true,
              createdAt: true,
              nodeType: true,
            },
          },
          automation: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!workspace) return null

  const isMember = workspace.members.some(
    (member) => member.userId === profile.id,
  )
  if (!isMember) redirect('/dashboard')

  const executions: WorkflowExecution[] = workspace.automationRuns.map(
    (run) => {
      const status = statusMap[run.status] ?? 'pending'
      const finishedAt = run.finishedAt ?? null
      const durationMs =
        typeof run.durationMs === 'number'
          ? run.durationMs
          : finishedAt
            ? finishedAt.getTime() - run.startedAt.getTime()
            : null
      const failedEvent =
        run.events.find((event) => event.status === 'FAILED') ??
        run.events.find((event) =>
          /error|failed|exception|timeout/i.test(event.message ?? ''),
        )
      const logs = run.events.length
        ? run.events.map((event) =>
            [event.nodeType, event.message].filter(Boolean).join(': '),
          )
        : run.log
          ? run.log
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          : []

      return {
        id: run.id,
        workspaceId: run.workspaceId,
        workflowId: run.automationId,
        workflowName: run.automation.name,
        status,
        trigger: inferTrigger(logs),
        startedAt: run.startedAt.toISOString(),
        finishedAt: finishedAt?.toISOString() ?? null,
        durationMs,
        stepsTotal: run.events.length,
        stepsCompleted:
          run.events.length > 0
            ? run.events.filter((event) => event.status === 'SUCCESS').length
            : status === 'success'
              ? 1
              : 0,
        errorMessage:
          failedEvent?.message ?? (status === 'failed' ? run.log : null),
        logs,
        createdAt: run.startedAt.toISOString(),
        detailHref: `/dashboard/${workspace.slug}/automations/${run.automationId}/runs/${run.id}`,
        workflowHref: `/dashboard/${workspace.slug}/automations/${run.automationId}/builder`,
      }
    },
  )

  const hasRealExecutions = executions.length > 0
  const visibleExecutions = hasRealExecutions ? executions : mockExecutions
  const workflows = Array.from(
    new Set([
      ...workspace.automations.map((automation) => automation.name),
      ...visibleExecutions.map((execution) => execution.workflowName),
    ]),
  ).sort((a, b) => a.localeCompare(b))

  return (
    <DashboardShell className="max-w-7xl">
      <PageHeader
        title="Executions"
        description="Monitor workflow runs, failures, retries, and execution history across your workspace."
        actions={
          <>
            <Link
              href={`/dashboard/${workspace.slug}/executions`}
              className="text-neutral-text-primary inline-flex h-9 items-center rounded-xl border border-slate-700 bg-transparent px-3.5 text-sm font-medium transition-colors hover:bg-slate-900/60"
            >
              Refresh
            </Link>
            <Link
              href={`/dashboard/${workspace.slug}/automations`}
              className="border-brand-primary/80 hover:bg-brand-primary/90 inline-flex h-9 items-center rounded-xl border bg-brand-primary px-3.5 text-sm font-medium text-white transition-colors"
            >
              View automations
            </Link>
          </>
        }
      />

      <ExecutionsClient
        executions={visibleExecutions}
        workflows={workflows}
        workspaceSlug={workspace.slug}
        hasRealExecutions={hasRealExecutions}
      />
    </DashboardShell>
  )
}

function inferTrigger(logs: string[]) {
  const joined = logs.join(' ').toLowerCase()

  if (joined.includes('schedule') || joined.includes('cron')) return 'Schedule'
  if (joined.includes('form')) return 'Form submission'
  if (joined.includes('manual')) return 'Manual run'
  if (joined.includes('webhook')) return 'Webhook'

  return 'Workflow run'
}

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ReportsClient } from '@/components/dashboard/reports/ReportsClient'
import { prisma } from '@/lib/db'
import type { ScheduledReport, WorkspaceReport } from '@/lib/reports/types'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

type PageProps = {
  params: { workspaceSlug: string }
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

const mockReports: WorkspaceReport[] = [
  {
    id: 'report-weekly-summary',
    workspaceId: 'preview',
    title: 'Weekly Business Summary',
    type: 'summary',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    createdBy: 'Corbin',
    shared: true,
    summary:
      'Most automations ran successfully this week. One failed execution requires review. Three tasks are overdue. Consider creating a review request automation for completed client work.',
    metrics: [
      { label: 'Completed tasks', value: '24' },
      { label: 'Failed automations', value: '1' },
      { label: 'Overdue tasks', value: '3' },
      { label: 'Client updates', value: '12' },
    ],
    recommendations: [
      'Review the failed lead follow-up workflow.',
      'Create a review request automation for completed client work.',
      'Clear overdue follow-up tasks before next week.',
    ],
    isMock: true,
  },
  {
    id: 'report-automation-performance',
    workspaceId: 'preview',
    title: 'Automation Performance',
    type: 'automation',
    status: 'ready',
    generatedAt: daysAgo(1),
    createdBy: 'Skillify AI',
    shared: false,
    summary:
      'Automation throughput is steady. Workflow completion rates are strong, with one lead follow-up issue creating the highest operational risk.',
    metrics: [
      { label: 'Success rate', value: '80%' },
      { label: 'Total runs', value: '5' },
      { label: 'Failed runs', value: '1' },
      { label: 'Average duration', value: '1.3s' },
    ],
    recommendations: [
      'Add validation before sending lead follow-up messages.',
      'Monitor failed runs daily until the retry flow is live.',
      'Create a weekly workflow health report schedule.',
    ],
    isMock: true,
  },
  {
    id: 'report-client-activity',
    workspaceId: 'preview',
    title: 'Client Activity Report',
    type: 'clients',
    status: 'ready',
    generatedAt: daysAgo(7),
    createdBy: 'Corbin',
    shared: true,
    summary:
      'Client work is moving, but follow-up visibility can improve. Recent activity shows several open tasks and a need for more consistent communication reminders.',
    metrics: [
      { label: 'Active clients', value: '18' },
      { label: 'Follow-ups due', value: '6' },
      { label: 'Client tasks', value: '31' },
      { label: 'Shared updates', value: '9' },
    ],
    recommendations: [
      'Group clients by status to make follow-up easier.',
      'Add task reminders for stale client work.',
      'Generate a client activity summary every Monday.',
    ],
    isMock: true,
  },
  {
    id: 'report-task-operations',
    workspaceId: 'preview',
    title: 'Task & Operations Report',
    type: 'operations',
    status: 'ready',
    generatedAt: daysAgo(7),
    createdBy: 'Skillify AI',
    shared: false,
    summary:
      'Operations are mostly on track. Three overdue tasks should be reviewed, and repeatable task patterns are ready to become automated workflows.',
    metrics: [
      { label: 'Tasks completed', value: '24' },
      { label: 'Tasks overdue', value: '3' },
      { label: 'Assignments open', value: '11' },
      { label: 'Processes tracked', value: '5' },
    ],
    recommendations: [
      'Turn recurring task reminders into an automation.',
      'Create a weekly operations review report.',
      'Assign clear owners to overdue work.',
    ],
    isMock: true,
  },
]

const mockScheduledReports: ScheduledReport[] = [
  {
    id: 'schedule-weekly-summary',
    workspaceId: 'preview',
    reportType: 'summary',
    title: 'Weekly Business Summary',
    frequency: 'Every Monday at 8:00 AM',
    recipients: ['owner@skillify.local'],
    nextRunAt: 'Next Monday at 8:00 AM',
    enabled: true,
    isMock: true,
  },
  {
    id: 'schedule-automation-performance',
    workspaceId: 'preview',
    reportType: 'automation',
    title: 'Automation Performance Report',
    frequency: 'Every Friday at 4:00 PM',
    recipients: ['ops@skillify.local'],
    nextRunAt: 'Friday at 4:00 PM',
    enabled: true,
    isMock: true,
  },
]

export default async function ReportsPage({ params }: PageProps) {
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
    },
  })

  if (!workspace) return null

  const isMember = workspace.members.some(
    (member) => member.userId === profile.id,
  )
  if (!isMember) redirect('/dashboard')

  const reports: WorkspaceReport[] = []
  const scheduledReports: ScheduledReport[] = []
  const hasRealReports = reports.length > 0
  const visibleReports = hasRealReports
    ? reports
    : mockReports.map((report) => ({
        ...report,
        workspaceId: workspace.id,
      }))
  const visibleScheduledReports = hasRealReports
    ? scheduledReports
    : mockScheduledReports.map((report) => ({
        ...report,
        workspaceId: workspace.id,
      }))
  const workspacePlan = await getWorkspacePlan(workspace.id, userId)

  return (
    <DashboardShell className="max-w-7xl">
      <ReportsClient
        reports={visibleReports}
        scheduledReports={visibleScheduledReports}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspacePlan={workspacePlan}
        hasRealReports={hasRealReports}
      />
    </DashboardShell>
  )
}

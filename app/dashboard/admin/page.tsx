// app/dashboard/admin/page.tsx

import Link from 'next/link'
import {
  Building2,
  Bot,
  HeartPulse,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'

import { AdminForbidden } from '@/components/admin/AdminForbidden'
import {
  AdminAlertSummary,
  type AdminAlertItem,
  type AdminAlertSeverity,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatsGrid,
} from '@/components/admin/AdminPage'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { prisma } from '@/lib/db'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

const adminCards = [
  {
    title: 'Users',
    description:
      'Review platform accounts, subscriptions, roles, and workspace access.',
    href: '/dashboard/admin/users',
    label: 'Manage users',
    icon: Users,
    metricKey: 'users',
  },
  {
    title: 'Service Requests',
    description:
      'Review customer requests for additional automation, integrations, CRM setup, and done-for-you support.',
    href: '/dashboard/admin/upsells',
    label: 'View service requests',
    icon: Sparkles,
    metricKey: 'serviceRequests',
  },
  {
    title: 'Build Requests',
    description:
      'Triage done-for-you implementation requests across customer workspaces.',
    href: '/dashboard/admin/build-requests',
    label: 'Review builds',
    icon: Wrench,
    metricKey: 'builds',
  },
  {
    title: 'Enterprise',
    description:
      'Manage enterprise consults, entitlements, security reviews, and compliance requests.',
    href: '/dashboard/admin/enterprise',
    label: 'Open enterprise',
    icon: Building2,
    metricKey: 'enterprise',
  },
  {
    title: 'System',
    description:
      'Monitor platform health, workspaces, automations, and operational diagnostics.',
    href: '/dashboard/admin/system',
    label: 'Open system',
    icon: HeartPulse,
    metricKey: 'system',
  },
  {
    title: 'AI Playground',
    description:
      'Test Workspace AI, providers, runtime events, knowledge providers, structured outputs, and proposal-only actions.',
    href: '/dashboard/admin/ai-playground',
    label: 'Open AI Playground',
    icon: Bot,
    metricKey: 'playground',
  },
] as const

export default async function AdminIndexPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const [
    totalUsers,
    workspaceCount,
    openBuildRequests,
    failedRuns,
    pendingServiceRequests,
    enterpriseCount,
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.workspace.count(),
    prisma.buildRequest.count({
      where: { status: { in: ['NEW', 'REVIEWING'] } },
    }),
    prisma.automationRun.count({ where: { status: 'FAILED' } }),
    prisma.upsellRequest.count({
      where: { status: { in: ['pending', 'new', 'open'] } },
    }),
    prisma.enterpriseConsultRequest.count(),
  ])

  const platformHealth = failedRuns > 0 ? 'Review' : 'Operational'
  const metricByKey: Record<(typeof adminCards)[number]['metricKey'], string> =
    {
      users: totalUsers.toLocaleString(),
      serviceRequests: pendingServiceRequests.toLocaleString(),
      builds: openBuildRequests.toLocaleString(),
      enterprise: enterpriseCount.toLocaleString(),
      system: platformHealth,
      playground: 'Internal',
    }
  const alertItems: AdminAlertItem[] = [
    ...(failedRuns > 0
      ? [
          {
            label: 'Failed automation runs',
            description: `${failedRuns} automation ${
              failedRuns === 1 ? 'run has' : 'runs have'
            } failed and may need operational review.`,
            href: '/dashboard/admin/system',
            severity: 'error' as const,
          },
        ]
      : []),
    ...(openBuildRequests > 0
      ? [
          {
            label: 'Open build requests',
            description: `${openBuildRequests} done-for-you ${
              openBuildRequests === 1
                ? 'build request is'
                : 'build requests are'
            } awaiting review or implementation.`,
            href: '/dashboard/admin/build-requests',
            severity: 'warning' as const,
          },
        ]
      : []),
    ...(pendingServiceRequests > 0
      ? [
          {
            label: 'Pending service requests',
            description: `${pendingServiceRequests} customer ${
              pendingServiceRequests === 1
                ? 'service request needs'
                : 'service requests need'
            } triage.`,
            href: '/dashboard/admin/upsells',
            severity: 'warning' as const,
          },
        ]
      : []),
    ...(enterpriseCount > 0
      ? [
          {
            label: 'Enterprise consult requests',
            description: `${enterpriseCount} enterprise ${
              enterpriseCount === 1
                ? 'consult request is'
                : 'consult requests are'
            } available for review.`,
            href: '/dashboard/admin/enterprise',
            severity: 'info' as const,
          },
        ]
      : []),
  ]
  const alertSeverity: AdminAlertSeverity = alertItems.some(
    (item) => item.severity === 'error',
  )
    ? 'error'
    : alertItems.some((item) => item.severity === 'warning')
      ? 'warning'
      : alertItems.some((item) => item.severity === 'info')
        ? 'info'
        : 'success'

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Admin Panel"
        subtitle="Manage Skillify backend operations, users, requests, enterprise accounts, and platform health."
      />

      <AdminStatsGrid>
        <AdminStatCard label="Total Users" value={totalUsers} />
        <AdminStatCard label="Workspaces" value={workspaceCount} />
        <AdminStatCard label="Open Build Requests" value={openBuildRequests} />
        <AdminStatCard
          label="Platform Health"
          value={platformHealth}
          hint={
            failedRuns > 0 ? `${failedRuns} failed runs recorded` : undefined
          }
        />
      </AdminStatsGrid>

      <AdminAlertSummary
        severity={alertSeverity}
        title={alertItems.length ? 'Operational attention' : 'Platform healthy'}
        description={
          alertItems.length
            ? 'Review the items below to keep customer operations moving.'
            : 'No operational warnings are currently detected.'
        }
        items={alertItems}
      />

      <AdminSection>
        <div className="border-b border-slate-800/80 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Control Center
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Jump into the primary backend workflows.
              </p>
            </div>
            <Badge
              size="xs"
              variant={
                alertSeverity === 'error'
                  ? 'red'
                  : alertSeverity === 'warning'
                    ? 'yellow'
                    : alertSeverity === 'success'
                      ? 'green'
                      : 'blue'
              }
            >
              {platformHealth}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {adminCards.map((card) => {
            const Icon = card.icon

            return (
              <div
                key={card.href}
                className="flex min-h-48 flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/70 p-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <Badge size="xs" variant="slate">
                      {metricByKey[card.metricKey]}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-50">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-slate-400">
                      {card.description}
                    </p>
                  </div>
                </div>

                <Button asChild size="sm" variant="secondary" className="mt-4">
                  <Link href={card.href}>{card.label}</Link>
                </Button>
              </div>
            )
          })}
        </div>
      </AdminSection>
    </div>
  )
}

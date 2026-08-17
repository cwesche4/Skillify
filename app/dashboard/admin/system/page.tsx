// app/dashboard/admin/system/page.tsx

import Link from 'next/link'

import { prisma } from '@/lib/db'
import { AdminForbidden } from '@/components/admin/AdminForbidden'
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatsGrid,
  AdminTable,
  adminTableCellClass,
  adminTableHeadClass,
  adminTableHeaderClass,
  adminTableRowClass,
} from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

function formatDate(date: Date | null) {
  if (!date) return '-'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) return '-'
  if (durationMs < 1000) return `${durationMs}ms`

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatError(log: string | null) {
  if (!log?.trim()) return 'No error log recorded.'

  const lines = log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const likelyError =
    lines.find((line) => /error|failed|exception|timeout/i.test(line)) ??
    lines[lines.length - 1]

  if (!likelyError) return 'No error log recorded.'
  return likelyError.length > 140
    ? `${likelyError.slice(0, 140).trim()}...`
    : likelyError
}

export default async function AdminSystemPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const [
    workspaceCount,
    automationCount,
    activeUserCount,
    failingRuns,
    recentFailedRuns,
  ] = await Promise.all([
    prisma.workspace.count(),
    prisma.automation.count(),
    prisma.userProfile.count({
      where: {
        memberships: {
          some: {},
        },
      },
    }),
    prisma.automationRun.count({
      where: {
        status: 'FAILED',
      },
    }),
    prisma.automationRun.findMany({
      where: {
        status: 'FAILED',
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        log: true,
        automation: {
          select: {
            id: true,
            name: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
  ])

  const platformHealth = failingRuns > 0 ? 'Review' : 'Operational'

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="System"
        subtitle="Monitor platform-wide operating health and workspace diagnostics."
      />

      <AdminStatsGrid>
        <AdminStatCard label="Workspaces" value={workspaceCount} />
        <AdminStatCard label="Automations" value={automationCount} />
        <AdminStatCard label="Active Users" value={activeUserCount} />
        <AdminStatCard
          label="Platform Health"
          value={platformHealth}
          hint={
            failingRuns > 0 ? `${failingRuns} failed runs recorded` : undefined
          }
        />
      </AdminStatsGrid>

      <AdminSection className="p-0">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Failed Automation Runs
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Review recent failed runs and jump directly to the affected
            automation.
          </p>
        </div>

        {recentFailedRuns.length ? (
          <AdminTable minWidth="min-w-[980px]">
            <thead className={adminTableHeaderClass}>
              <tr>
                <th className={adminTableHeadClass}>Workspace</th>
                <th className={adminTableHeadClass}>Automation</th>
                <th className={adminTableHeadClass}>Status</th>
                <th className={adminTableHeadClass}>Error</th>
                <th className={adminTableHeadClass}>Failed At</th>
                <th className={`${adminTableHeadClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {recentFailedRuns.map((run) => {
                const actionHref = `/dashboard/${run.workspace.slug}/automations/${run.automation.id}/runs/${run.id}`

                return (
                  <tr key={run.id} className={adminTableRowClass}>
                    <td className={adminTableCellClass}>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-100">
                          {run.workspace.name}
                        </div>
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            Workspace details
                          </summary>
                          <div className="mt-1 space-y-0.5 font-mono">
                            <div>Slug: {run.workspace.slug}</div>
                            <div>ID: {run.workspace.id}</div>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className={adminTableCellClass}>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-100">
                          {run.automation.name}
                        </div>
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            Automation details
                          </summary>
                          <div className="mt-1 space-y-0.5 font-mono">
                            <div>ID: {run.automation.id}</div>
                            <div>Run: {run.id}</div>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className={adminTableCellClass}>
                      <div className="space-y-1">
                        <Badge size="xs" variant="red">
                          {run.status}
                        </Badge>
                        <div className="text-[11px] text-slate-500">
                          Duration: {formatDuration(run.durationMs)}
                        </div>
                      </div>
                    </td>
                    <td className={`${adminTableCellClass} max-w-sm`}>
                      <div className="space-y-1">
                        <p className="text-sm text-slate-300">
                          {formatError(run.log)}
                        </p>
                        {run.log ? (
                          <details className="text-[11px] text-slate-500">
                            <summary className="cursor-pointer select-none">
                              Full log
                            </summary>
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-400">
                              {run.log}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${adminTableCellClass} text-slate-400`}>
                      <div className="space-y-1 text-xs">
                        <div>{formatDate(run.finishedAt ?? run.startedAt)}</div>
                        <div className="text-slate-500">
                          Started: {formatDate(run.startedAt)}
                        </div>
                      </div>
                    </td>
                    <td
                      className={`${adminTableCellClass} text-right text-slate-400`}
                    >
                      <Button asChild size="sm" variant="secondary">
                        <Link href={actionHref}>Open run</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </AdminTable>
        ) : (
          <div className="p-5">
            <AdminEmptyState
              title="No failed automation runs"
              description="Recent automation health is clear. Failed runs will appear here if they occur."
            />
          </div>
        )}
      </AdminSection>

      <AdminSection className="p-0">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            System Controls
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Workspace diagnostics and operational controls will appear here as
            they are added.
          </p>
        </div>
        <div className="p-5">
          <AdminEmptyState
            title="No system controls configured"
            description="This page is ready for platform diagnostics, health checks, and global controls as those tools come online."
          />
        </div>
      </AdminSection>
    </div>
  )
}

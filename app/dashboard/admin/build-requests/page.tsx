// app/dashboard/admin/build-requests/page.tsx

import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'
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
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function requestStatusVariant(status: string) {
  if (status === 'CLOSED') return 'green'
  if (status === 'REVIEWING') return 'blue'
  return 'yellow'
}

export default async function BuildRequestsAdminPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const requests = await prisma.buildRequest.findMany({
    orderBy: { createdAt: 'desc' },
  })
  const workspaceIds = Array.from(
    new Set(requests.map((request) => request.workspaceId).filter(Boolean)),
  ) as string[]
  const workspaces = workspaceIds.length
    ? await prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, name: true, slug: true },
      })
    : []
  const workspaceById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace]),
  )

  const openCount = requests.filter(
    (request) => request.status === 'NEW',
  ).length
  const inProgressCount = requests.filter(
    (request) => request.status === 'REVIEWING',
  ).length
  const completedCount = requests.filter(
    (request) => request.status === 'CLOSED',
  ).length

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Build Requests"
        subtitle="Review high-intent teams asking Skillify to build or rebuild their automation systems across all workspaces."
      />

      <AdminStatsGrid>
        <AdminStatCard label="Open Requests" value={openCount} />
        <AdminStatCard label="In Progress" value={inProgressCount} />
        <AdminStatCard label="Completed" value={completedCount} />
        <AdminStatCard
          label="Average Completion Time"
          value="N/A"
          hint="Completion timestamp not tracked yet"
        />
      </AdminStatsGrid>

      {requests.length === 0 ? (
        <AdminEmptyState
          title="No build requests yet"
          description="When teams submit done-for-you build requests, they will appear here."
        />
      ) : (
        <AdminSection>
          <AdminTable minWidth="min-w-[940px]">
            <thead className={adminTableHeaderClass}>
              <tr>
                <th className={adminTableHeadClass}>Contact</th>
                <th className={adminTableHeadClass}>Company</th>
                <th className={adminTableHeadClass}>Workspace</th>
                <th className={adminTableHeadClass}>Project</th>
                <th className={adminTableHeadClass}>Status</th>
                <th className={adminTableHeadClass}>Timeline</th>
                <th className={`${adminTableHeadClass} text-right`}>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {requests.map((request) => (
                <tr key={request.id} className={adminTableRowClass}>
                  <td className={adminTableCellClass}>
                    <div className="space-y-1">
                      <div className="font-medium text-slate-50">
                        {request.name || 'Unknown contact'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {request.email}
                      </div>
                      {request.phone ? (
                        <div className="text-xs text-slate-500">
                          {request.phone}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${adminTableCellClass} text-slate-300`}>
                    <div className="space-y-1">
                      <div>{request.company || 'No company'}</div>
                      {request.website ? (
                        <div className="text-xs text-slate-500">
                          {request.website}
                        </div>
                      ) : null}
                      {request.size ? (
                        <div className="text-xs text-slate-500">
                          Team size: {request.size}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${adminTableCellClass} text-slate-300`}>
                    {request.workspaceId ? (
                      <div className="space-y-1">
                        <div className="font-medium text-slate-100">
                          {workspaceById.get(request.workspaceId)?.name ??
                            'Unknown workspace'}
                        </div>
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            Workspace details
                          </summary>
                          <div className="mt-1 space-y-0.5 font-mono">
                            <div>
                              Slug:{' '}
                              {workspaceById.get(request.workspaceId)?.slug ??
                                'unknown'}
                            </div>
                            <div>ID: {request.workspaceId}</div>
                          </div>
                        </details>
                      </div>
                    ) : (
                      <span className="text-slate-500">Public lead</span>
                    )}
                  </td>
                  <td className={adminTableCellClass}>
                    <div className="max-w-sm space-y-2">
                      <div className="font-medium text-slate-100">
                        {request.projectType || 'Automation build'}
                      </div>
                      <p className="line-clamp-2 text-xs text-slate-400">
                        {request.projectSummary}
                      </p>
                      <details className="text-[11px] text-slate-500">
                        <summary className="cursor-pointer select-none">
                          Request details
                        </summary>
                        <div className="mt-1 space-y-1">
                          <p className="whitespace-pre-wrap text-slate-400">
                            {request.projectSummary}
                          </p>
                          <div className="font-mono">ID: {request.id}</div>
                          {request.userId ? (
                            <div className="font-mono">
                              User: {request.userId}
                            </div>
                          ) : null}
                          {request.workspaceId ? (
                            <div className="font-mono">
                              Workspace: {request.workspaceId}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </div>
                  </td>
                  <td className={adminTableCellClass}>
                    <Badge
                      size="xs"
                      variant={requestStatusVariant(request.status)}
                    >
                      {request.status}
                    </Badge>
                  </td>
                  <td className={`${adminTableCellClass} text-slate-300`}>
                    <div className="space-y-1 text-xs">
                      <div>{request.timeline || 'Timeline not provided'}</div>
                      <div className="text-slate-500">
                        {request.budgetRange || 'Budget not provided'}
                      </div>
                    </div>
                  </td>
                  <td
                    className={`${adminTableCellClass} text-right text-slate-400`}
                  >
                    {formatDate(request.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </AdminSection>
      )}
    </div>
  )
}

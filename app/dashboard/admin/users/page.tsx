// app/dashboard/admin/users/page.tsx

import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import { AdminForbidden } from '@/components/admin/AdminForbidden'
import {
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

function roleVariant(role: string): BadgeVariant {
  if (role === 'admin') return 'purple'
  return 'slate'
}

function workspaceRoleVariant(role: string): BadgeVariant {
  if (role === 'OWNER') return 'yellow'
  if (role === 'ADMIN') return 'blue'
  return 'slate'
}

export default async function AdminUsersPage() {
  const admin = await getGlobalAdminProfile()

  // Must be global admin
  if (!admin) {
    return <AdminForbidden />
  }

  const [users, workspaceCount] = await Promise.all([
    prisma.userProfile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clerkId: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
          },
        },
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                ownerId: true,
              },
            },
          },
        },
      },
    }),
    prisma.workspace.count(),
  ])

  const adminCount = users.filter((user) => user.role === 'admin').length
  const eliteCount = users.filter(
    (user) => user.subscription?.plan === 'Elite',
  ).length

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Admin Users"
        subtitle="Manage platform users, subscriptions, roles, and workspace access."
      />

      <AdminStatsGrid>
        <AdminStatCard label="Total Users" value={users.length} />
        <AdminStatCard label="Admins" value={adminCount} />
        <AdminStatCard label="Elite Users" value={eliteCount} />
        <AdminStatCard label="Workspaces" value={workspaceCount} />
      </AdminStatsGrid>

      <AdminSection>
        <AdminTable minWidth="min-w-[1040px]">
          <thead className={adminTableHeaderClass}>
            <tr>
              <th className={adminTableHeadClass}>Name</th>
              <th className={adminTableHeadClass}>Email</th>
              <th className={adminTableHeadClass}>Global Role</th>
              <th className={adminTableHeadClass}>Plan</th>
              <th className={adminTableHeadClass}>Status</th>
              <th className={adminTableHeadClass}>Workspaces</th>
              <th className={adminTableHeadClass}>Workspace Role</th>
              <th className={`${adminTableHeadClass} text-right`}>Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {users.map((user) => {
              const workspaces = user.memberships.map((membership) => ({
                ...membership.workspace,
                role: membership.role,
                isOwner: membership.workspace.ownerId === user.id,
              }))
              const displayName = user.fullName || user.email || 'Unnamed user'
              const planLabel = user.subscription?.plan ?? 'Free'
              const statusLabel = user.subscription?.status ?? 'none'

              return (
                <tr key={user.id} className={adminTableRowClass}>
                  <td className={adminTableCellClass}>
                    <div className="min-w-44 space-y-1.5">
                      <div className="font-medium text-slate-50">
                        {displayName}
                      </div>
                      <details className="text-[11px] text-slate-500">
                        <summary className="cursor-pointer select-none">
                          IDs
                        </summary>
                        <div className="mt-1 space-y-0.5 font-mono">
                          <div>User: {user.id}</div>
                          <div>Clerk: {user.clerkId}</div>
                        </div>
                      </details>
                    </div>
                  </td>
                  <td className={`${adminTableCellClass} text-slate-300`}>
                    {user.email ?? 'No email'}
                  </td>
                  <td className={adminTableCellClass}>
                    <Badge size="xs" variant={roleVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className={adminTableCellClass}>
                    <Badge
                      size="xs"
                      variant={planLabel === 'Elite' ? 'blue' : 'slate'}
                    >
                      {planLabel}
                    </Badge>
                  </td>
                  <td className={adminTableCellClass}>
                    <Badge
                      size="xs"
                      variant={statusLabel === 'active' ? 'green' : 'slate'}
                    >
                      {statusLabel}
                    </Badge>
                  </td>
                  <td className={adminTableCellClass}>
                    {workspaces.length ? (
                      <div className="min-w-56 space-y-2.5">
                        {workspaces.map((workspace) => (
                          <div key={workspace.id} className="space-y-1">
                            <div className="font-medium text-slate-100">
                              {workspace.name}
                            </div>
                            <details className="text-[11px] text-slate-500">
                              <summary className="cursor-pointer select-none">
                                Workspace details
                              </summary>
                              <div className="mt-1 space-y-0.5 font-mono">
                                <div>Slug: {workspace.slug}</div>
                                <div>ID: {workspace.id}</div>
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">No workspaces</span>
                    )}
                  </td>
                  <td className={adminTableCellClass}>
                    {workspaces.length ? (
                      <div className="space-y-2.5">
                        {workspaces.map((workspace) => (
                          <div
                            key={`${workspace.id}-${workspace.role}`}
                            className="flex flex-wrap items-center gap-1.5"
                          >
                            <Badge
                              size="xs"
                              variant={workspaceRoleVariant(workspace.role)}
                            >
                              {workspace.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td
                    className={`${adminTableCellClass} text-right text-slate-400`}
                  >
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>
      </AdminSection>
    </div>
  )
}

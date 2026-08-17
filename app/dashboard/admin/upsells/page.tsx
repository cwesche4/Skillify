// app/dashboard/admin/upsells/page.tsx

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

function statusVariant(status: string) {
  const normalized = status.toLowerCase()
  if (['approved', 'completed', 'closed'].includes(normalized)) return 'green'
  if (['pending', 'new', 'open'].includes(normalized)) return 'yellow'
  if (['rejected', 'declined', 'canceled'].includes(normalized)) return 'red'
  return 'slate'
}

export default async function UpsellsAdminPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const [upsells, purchaseRevenue] = await Promise.all([
    prisma.upsellRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        automation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.microUpsellPurchase.aggregate({
      _sum: { price: true },
    }),
  ])

  const pendingCount = upsells.filter((upsell) =>
    ['pending', 'new', 'open'].includes(upsell.status.toLowerCase()),
  ).length
  const approvedCount = upsells.filter((upsell) =>
    ['approved', 'completed', 'closed'].includes(upsell.status.toLowerCase()),
  ).length
  const revenue = purchaseRevenue._sum.price ?? 0

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Service Requests"
        subtitle="Review customer requests for additional automation, integrations, CRM setup, and done-for-you support."
      />

      <AdminStatsGrid>
        <AdminStatCard label="Total Requests" value={upsells.length} />
        <AdminStatCard label="Pending" value={pendingCount} />
        <AdminStatCard label="Approved" value={approvedCount} />
        <AdminStatCard label="Revenue" value={`$${revenue.toLocaleString()}`} />
      </AdminStatsGrid>

      {upsells.length === 0 ? (
        <AdminEmptyState
          title="No service requests yet"
          description="When customers request micro builds or done-for-you help, those requests will appear here."
        />
      ) : (
        <AdminSection>
          <AdminTable>
            <thead className={adminTableHeaderClass}>
              <tr>
                <th className={adminTableHeadClass}>Request</th>
                <th className={adminTableHeadClass}>User</th>
                <th className={adminTableHeadClass}>Workspace</th>
                <th className={adminTableHeadClass}>Status</th>
                <th className={adminTableHeadClass}>Automation</th>
                <th className={`${adminTableHeadClass} text-right`}>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {upsells.map((upsell) => {
                const displayUser =
                  upsell.user.fullName || upsell.user.email || 'Unknown user'

                return (
                  <tr key={upsell.id} className={adminTableRowClass}>
                    <td className={adminTableCellClass}>
                      <div className="max-w-md space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            size="xs"
                            variant={upsell.type === 'micro' ? 'blue' : 'slate'}
                          >
                            {upsell.type === 'micro' ? 'Micro' : upsell.type}
                          </Badge>
                          <span className="font-medium text-slate-50">
                            {upsell.description.slice(0, 90)}
                            {upsell.description.length > 90 ? '...' : ''}
                          </span>
                        </div>
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            Request details
                          </summary>
                          <div className="mt-1 space-y-1">
                            <p className="whitespace-pre-wrap text-slate-400">
                              {upsell.description}
                            </p>
                            <div className="font-mono">ID: {upsell.id}</div>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className={`${adminTableCellClass} text-slate-300`}>
                      <div className="space-y-1">
                        <div>{displayUser}</div>
                        {upsell.user.email ? (
                          <div className="text-xs text-slate-500">
                            {upsell.user.email}
                          </div>
                        ) : null}
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            User ID
                          </summary>
                          <div className="mt-1 font-mono">{upsell.userId}</div>
                        </details>
                      </div>
                    </td>
                    <td className={`${adminTableCellClass} text-slate-300`}>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-100">
                          {upsell.workspace.name}
                        </div>
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            Workspace details
                          </summary>
                          <div className="mt-1 space-y-0.5 font-mono">
                            <div>Slug: {upsell.workspace.slug}</div>
                            <div>ID: {upsell.workspace.id}</div>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className={adminTableCellClass}>
                      <Badge size="xs" variant={statusVariant(upsell.status)}>
                        {upsell.status}
                      </Badge>
                    </td>
                    <td className={`${adminTableCellClass} text-slate-300`}>
                      {upsell.automation ? (
                        <div className="space-y-1">
                          <div className="font-medium text-slate-100">
                            {upsell.automation.name}
                          </div>
                          <details className="text-[11px] text-slate-500">
                            <summary className="cursor-pointer select-none">
                              Automation ID
                            </summary>
                            <div className="mt-1 font-mono">
                              {upsell.automation.id}
                            </div>
                          </details>
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          No linked automation
                        </span>
                      )}
                    </td>
                    <td
                      className={`${adminTableCellClass} text-right text-slate-400`}
                    >
                      {formatDate(upsell.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </AdminTable>
        </AdminSection>
      )}
    </div>
  )
}

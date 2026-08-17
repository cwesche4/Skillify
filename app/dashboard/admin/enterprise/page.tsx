// app/dashboard/admin/enterprise/page.tsx

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

function enterpriseStatusVariant(status: string) {
  if (status === 'CLOSED') return 'green'
  if (status === 'QUALIFIED') return 'blue'
  if (status === 'CONTACTED') return 'purple'
  return 'yellow'
}

export default async function EnterpriseAdminPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const [consults, activeContractRows, securityReviews, complianceRequests] =
    await Promise.all([
      prisma.enterpriseConsultRequest.findMany({
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
        },
      }),
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM "ContractEntitlement"
        WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()
      `,
      prisma.securityPackRequest.count({
        where: {
          reviewType: 'SECURITY_REVIEW',
        },
      }),
      prisma.securityPackRequest.count({
        where: {
          reviewType: { in: ['SOC2_ESCALATION', 'AUDIT_REQUEST'] },
        },
      }),
    ])
  const activeContracts = activeContractRows[0]?.count ?? 0

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Enterprise"
        subtitle="Manage enterprise consults, active entitlements, security reviews, and compliance requests across all workspaces."
      />

      <AdminStatsGrid>
        <AdminStatCard label="Enterprise Accounts" value={consults.length} />
        <AdminStatCard label="Active Contracts" value={activeContracts} />
        <AdminStatCard label="Security Reviews" value={securityReviews} />
        <AdminStatCard label="Compliance Requests" value={complianceRequests} />
      </AdminStatsGrid>

      {consults.length === 0 ? (
        <AdminEmptyState
          title="No enterprise consults yet"
          description="When teams ask for full build-outs or enterprise support, consult requests will appear here."
        />
      ) : (
        <AdminSection>
          <AdminTable minWidth="min-w-[920px]">
            <thead className={adminTableHeaderClass}>
              <tr>
                <th className={adminTableHeadClass}>Contact</th>
                <th className={adminTableHeadClass}>Company</th>
                <th className={adminTableHeadClass}>Goal</th>
                <th className={adminTableHeadClass}>Status</th>
                <th className={`${adminTableHeadClass} text-right`}>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {consults.map((consult) => {
                const displayUser =
                  consult.user.fullName || consult.user.email || consult.name

                return (
                  <tr key={consult.id} className={adminTableRowClass}>
                    <td className={adminTableCellClass}>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-50">
                          {consult.name || displayUser}
                        </div>
                        <div className="text-xs text-slate-400">
                          {consult.email}
                        </div>
                        {consult.phone ? (
                          <div className="text-xs text-slate-500">
                            {consult.phone}
                          </div>
                        ) : null}
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            User ID
                          </summary>
                          <div className="mt-1 font-mono">{consult.userId}</div>
                        </details>
                      </div>
                    </td>
                    <td className={`${adminTableCellClass} text-slate-300`}>
                      <div className="space-y-1">
                        <div>{consult.companySize || 'Size not provided'}</div>
                        <div className="text-xs text-slate-500">
                          Workspace: {consult.workspace.name}
                        </div>
                      </div>
                    </td>
                    <td className={adminTableCellClass}>
                      <div className="max-w-md space-y-2">
                        <div className="font-medium text-slate-100">
                          {consult.projectGoal || 'Enterprise build-out'}
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-400">
                          {consult.description}
                        </p>
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer select-none">
                            Consult details
                          </summary>
                          <div className="mt-1 space-y-1">
                            <p className="whitespace-pre-wrap text-slate-400">
                              {consult.description}
                            </p>
                            <div className="font-mono">ID: {consult.id}</div>
                            <div className="font-mono">
                              Workspace: {consult.workspaceId}
                            </div>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className={adminTableCellClass}>
                      <Badge
                        size="xs"
                        variant={enterpriseStatusVariant(consult.status)}
                      >
                        {consult.status}
                      </Badge>
                    </td>
                    <td
                      className={`${adminTableCellClass} text-right text-slate-400`}
                    >
                      {formatDate(consult.createdAt)}
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

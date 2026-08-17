// app/dashboard/admin/audit/page.tsx
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { AdminForbidden } from '@/components/admin/AdminForbidden'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

export const dynamic = 'force-dynamic'

type AuditRow = {
  id: string
  userId: string | null
  action: string
  target: string | null
  ip: string | null
  createdAt: Date
  email: string | null
  fullName: string | null
}

export default async function AdminAuditPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  /**
   * IMPORTANT:
   * Prisma.sql is ONLY valid inside $queryRaw.
   * This fixes the "Sql is not assignable to string" error.
   */
  const rows = await prisma.$queryRaw<AuditRow[]>(
    Prisma.sql`
      SELECT
        a.id,
        a."userId",
        a.action,
        a.target,
        a.ip,
        a."createdAt",
        u.email,
        u."fullName"
      FROM "AuditLog" a
      LEFT JOIN "UserProfile" u
        ON u.id = a."userId"
      ORDER BY a."createdAt" DESC
      LIMIT 250
    `,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">
          Security & administrative activity across the platform
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-xs">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.fullName ?? 'Unknown'}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.email ?? '—'}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 text-xs">{r.target ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="text-muted-foreground p-6 text-center text-sm">
            No audit logs found
          </div>
        )}
      </div>
    </div>
  )
}

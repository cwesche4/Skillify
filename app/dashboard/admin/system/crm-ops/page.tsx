// app/dashboard/admin/system/crm-ops/page.tsx
import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { classifyCRMError } from '@/lib/integrations/failureCategory'
import { AdminForbidden } from '@/components/admin/AdminForbidden'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

export default async function CRMOpsPage() {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const workspace = admin.firstWorkspace

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [circuitOpenedCount, webhooksCount, integrations] = workspace
    ? await Promise.all([
        prisma.auditLog.count({
          where: {
            workspaceId: workspace.id,
            action: 'CRM_CIRCUIT_OPENED',
            createdAt: { gte: since },
          },
        }),
        prisma.auditLog.count({
          where: {
            workspaceId: workspace.id,
            action: 'CRM_WEBHOOK_RECEIVED',
            createdAt: { gte: since },
          },
        }),
        prisma.integration.findMany({
          where: { workspaceId: workspace.id },
          select: { id: true, provider: true, status: true, metadata: true },
        }),
      ])
    : [0, 0, []]

  // Hourly webhook buckets (last 24h)
  const webhookBuckets = Array.from({ length: 24 }).map((_, idx) => {
    const bucketStart = new Date(since.getTime() + idx * 60 * 60 * 1000)
    const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000)
    return { start: bucketStart, end: bucketEnd, count: 0 }
  })

  const webhookLogs = workspace
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: workspace.id,
          action: 'CRM_WEBHOOK_RECEIVED',
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      })
    : []
  for (const log of webhookLogs) {
    const idx = Math.max(
      0,
      Math.min(
        23,
        Math.floor(
          (log.createdAt.getTime() - since.getTime()) / (60 * 60 * 1000),
        ),
      ),
    )
    webhookBuckets[idx].count += 1
  }

  return (
    <DashboardShell>
      <div className="space-y-4">
        <header>
          <h1 className="text-lg font-semibold text-slate-50">
            Admin • CRM Ops
          </h1>
          <p className="text-sm text-slate-400">
            Read-only operational diagnostics for CRM integrations (last 24h).
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-slate-400">Circuit opened (24h)</p>
            <p className="text-2xl font-semibold text-slate-50">
              {circuitOpenedCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-400">Webhooks received (24h)</p>
            <p className="text-2xl font-semibold text-slate-50">
              {webhooksCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-400">Integrations</p>
            <p className="text-2xl font-semibold text-slate-50">
              {integrations.length}
            </p>
          </Card>
        </div>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Webhook trend (24h)
          </p>
          <div className="mt-2 grid gap-1 md:grid-cols-4">
            {webhookBuckets.map((bucket, idx) => (
              <div
                key={idx}
                className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
              >
                <div className="flex items-center justify-between">
                  <span>{bucket.start.getHours()}:00</span>
                  <Badge size="xs" variant="gray">
                    {bucket.count}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">
              Integration health (read-only)
            </p>
            <Badge variant="blue">Elite</Badge>
          </div>
          <div className="space-y-2 font-mono text-[12px] text-slate-200">
            {integrations.length === 0 && <p>No integrations connected.</p>}
            {integrations.map((i) => {
              const meta = (i.metadata as any) || {}
              const lastError = meta.lastError ?? null
              const category = lastError
                ? classifyCRMError(String(lastError))
                : 'unknown'
              return (
                <div
                  key={i.id}
                  className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {i.provider} • {i.status}
                    </span>
                    <Badge size="xs" variant="gray">
                      {category}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    lastError: {lastError ? String(lastError) : 'none'}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}

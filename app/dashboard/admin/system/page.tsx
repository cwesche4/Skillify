// app/dashboard/admin/system/page.tsx

import Link from 'next/link'
import { requireWorkspaceAdmin } from '@/lib/auth/requireWorkspaceAdmin'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { prisma } from '@/lib/db'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function AdminSystemPage({ params }: PageProps) {
  const { workspace, user } = await requireWorkspaceAdmin(params.workspaceSlug)

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { plan: true },
  })
  const planLabel = subscription?.plan ?? 'Free'
  const isElite = planLabel === 'Elite'

  return (
    <DashboardShell>
      <div className="space-y-4">
        <header>
          <h1 className="text-lg font-semibold text-slate-50">
            Admin • System ({workspace.name})
          </h1>
          <p className="text-sm text-slate-400">
            Workspace-level settings, diagnostics and controls.
          </p>
        </header>

        {!isElite ? (
          <Card className="space-y-3 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
            <div className="flex items-center gap-2">
              <Badge variant="yellow">Upgrade</Badge>
              <span className="font-semibold">System admin is Elite-only.</span>
            </div>
            <p className="text-amber-100/80">
              Upgrade to Elite to manage system diagnostics and workspace-level
              controls.
            </p>
            <Button asChild size="sm" variant="primary">
              <Link href={`/dashboard/${params.workspaceSlug}/upsell?need=Elite`}>
                View Elite benefits
              </Link>
            </Button>
          </Card>
        ) : (
          <Card className="p-4 text-sm text-slate-300">
            {/* You can add real admin controls here later */}
            <p>System settings coming soon.</p>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}

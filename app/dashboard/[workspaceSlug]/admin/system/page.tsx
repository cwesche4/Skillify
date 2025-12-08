// app/dashboard/[workspaceSlug]/admin/system/page.tsx
import { requireWorkspaceAdmin } from '@/lib/auth/requireWorkspaceAdmin'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function AdminSystemPage({ params }: PageProps) {
  const { workspace } = await requireWorkspaceAdmin(params.workspaceSlug)

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

        <Card className="p-4 text-sm text-slate-300">
          {/* You can add real admin controls here later */}
          <p>System settings coming soon.</p>
        </Card>
      </div>
    </DashboardShell>
  )
}

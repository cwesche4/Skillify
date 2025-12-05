// app/dashboard/workspaces/[id]/page.tsx

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { SIDEBAR_ITEMS } from "@/components/dashboard/sidebar-items"

export default function WorkspaceHome({ params }: { params: { id: string } }) {
  return (
    <DashboardShell sidebarItems={SIDEBAR_ITEMS}>
      <h1 className="h2 mb-4">Workspace: {params.id}</h1>

      <div className="grid-2 mt-6">
        <a className="card" href={`/dashboard/workspaces/${params.id}/settings`}>
          Settings
        </a>
        <a className="card" href={`/dashboard/workspaces/${params.id}/members`}>
          Members
        </a>
      </div>
    </DashboardShell>
  )
}

import { notFound } from 'next/navigation'

import { DevelopmentDemoWorkspaceToolbox } from '@/components/admin/DevelopmentDemoWorkspaceToolbox'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/db'
import { getStoredDemoWorkspaceSummary } from '@/lib/dev/demoWorkspaceGenerator'
import { requireWorkspaceAdmin } from '@/lib/auth/requireWorkspaceAdmin'
import {
  findAvailableWorkspaceSlug,
  isMachineGeneratedWorkspaceSlug,
} from '@/lib/workspaces/workspaceSlugs'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function DevelopmentToolsPage({ params }: PageProps) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { workspace } = await requireWorkspaceAdmin(params.workspaceSlug)
  const demo = await getStoredDemoWorkspaceSummary(workspace.id)
  const suggestedSlug = await findAvailableWorkspaceSlug({
    name: workspace.name,
    isAvailable: async (slug) => {
      if (slug === workspace.slug) return true
      const existing = await prisma.workspace.findUnique({ where: { slug } })
      return !existing
    },
  })

  return (
    <DashboardShell
      title="Development Tools"
      description="Internal development utilities for the current workspace."
    >
      <DevelopmentDemoWorkspaceToolbox
        initialState={{
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            suggestedSlug,
            machineGeneratedSlug: isMachineGeneratedWorkspaceSlug(
              workspace.slug,
            ),
          },
          demo,
        }}
      />
    </DashboardShell>
  )
}

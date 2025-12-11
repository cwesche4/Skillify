// app/dashboard/admin/page.tsx

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireWorkspaceAdmin } from '@/lib/auth/currentUser'
import { requirePlan } from '@/lib/auth/route-guard'

interface PageProps {
  params: { workspaceSlug: string }
}

export default async function AdminIndexPage({ params }: PageProps) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  })

  if (!workspace) {
    notFound()
  }

  // Must be OWNER/ADMIN in this workspace
  await requireWorkspaceAdmin(workspace.id)

  // Elite-only access to the admin panel
  await requirePlan('Elite', workspace.id)

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-slate-50">Admin Panel</h1>
      <p className="text-sm text-slate-400">
        Manage workspace-level settings, members, DFY builds, upsells, and
        enterprise consults.
      </p>
    </div>
  )
}

import { auth } from '@clerk/nextjs/server'
import { WorkspaceMemberRole } from '@prisma/client'

import { InspectorAnalyticsView } from '@/components/analytics/InspectorAnalytics'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/db'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function InspectorAnalyticsPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: {
        some: { userId: profile.id },
      },
    },
    select: { id: true, name: true },
  })
  if (!workspace) return null

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId: profile.id, workspaceId: workspace.id },
    },
    select: { role: true },
  })
  const isAdmin =
    membership?.role === WorkspaceMemberRole.ADMIN ||
    membership?.role === WorkspaceMemberRole.OWNER

  const queries = await Promise.all([
    fetch(
      `/api/analytics/inspector/tab-usage?workspaceId=${workspace.id}&bucket=day`,
      { cache: 'no-store' },
    ),
    fetch(
      `/api/analytics/inspector/validation?workspaceId=${workspace.id}&bucket=day`,
      { cache: 'no-store' },
    ),
    fetch(
      `/api/analytics/inspector/ai?workspaceId=${workspace.id}&bucket=day`,
      { cache: 'no-store' },
    ),
    fetch(
      `/api/analytics/inspector/presets?workspaceId=${workspace.id}&bucket=day`,
      { cache: 'no-store' },
    ),
  ])

  const [tabUsage, validation, ai, presets] = await Promise.all(
    queries.map(async (res) => {
      if (!res.ok) return []
      const json = await res.json().catch(() => ({ data: [] }))
      return json?.data ?? []
    }),
  )

  return (
    <DashboardShell>
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold text-slate-100">
          Inspector analytics
        </h1>
        <p className="text-sm text-slate-400">Workspace: {workspace.name}</p>
      </div>

      <InspectorAnalyticsView
        tabUsage={tabUsage}
        validation={validation}
        ai={ai}
        presets={presets}
      />
      {isAdmin && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Admin insights (coming soon)
          </h3>
          <p className="mt-2 text-[12px] text-slate-400">
            Org-level Inspector insights will appear here for admins.
          </p>
        </div>
      )}
    </DashboardShell>
  )
}

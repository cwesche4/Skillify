// app/dashboard/[workspaceSlug]/page.tsx

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import WorkspaceDashboardGrid from '@/components/dashboard/WorkspaceDashboardGrid'
import type { WidgetId } from '@/components/dashboard/widgets'
import { WIDGETS } from '@/components/dashboard/widgets'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'

type WorkspacePageProps = {
  params: { workspaceSlug: string }
}

type LayoutState = Record<
  WidgetId,
  {
    visible: boolean
    order: number
  }
>

export default async function WorkspaceHomePage({
  params,
}: WorkspacePageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: true,
      automations: {
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 20,
          },
        },
      },
    },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
        <p className="text-neutral-text-secondary text-sm">
          The workspace <code>{params.workspaceSlug}</code> does not exist.
        </p>
      </DashboardShell>
    )
  }

  const isMember = workspace.members.some((m: any) => m.userId === profile.id)
  if (!isMember) {
    return (
      <DashboardShell>
        <h1 className="h2">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </DashboardShell>
    )
  }

  const recentRuns = workspace.automations.flatMap((a: any) => a.runs)
  const successRuns = recentRuns.filter((r: any) => r.status === 'SUCCESS')
  const successRate =
    recentRuns.length > 0
      ? ((successRuns.length / recentRuns.length) * 100).toFixed(1)
      : '0.0'

  const health: 'Excellent' | 'Good' | 'Needs Attention' =
    Number(successRate) >= 95
      ? 'Excellent'
      : Number(successRate) >= 80
        ? 'Good'
        : 'Needs Attention'

  const recentRunsView = recentRuns.map((run: any) => {
    const automation = workspace.automations.find((a: any) =>
      a.runs.some((r: any) => r.id === run.id),
    )

    const finishedAt = run.finishedAt ?? run.startedAt
    const durationMs =
      run.durationMs ?? finishedAt.getTime() - run.startedAt.getTime()

    const durationLabel =
      typeof durationMs === 'number'
        ? `${Math.round(durationMs)} ms`
        : 'in progress'

    return {
      id: run.id,
      name: automation?.name ?? 'Automation',
      status: run.status,
      timestamp: run.startedAt.toISOString(),
      duration: durationLabel,
    }
  })

  const pref = await prisma.dashboardPreference.findUnique({
    where: {
      userId_workspaceId: {
        userId: profile.id,
        workspaceId: workspace.id,
      },
    },
  })

  let initialLayout: LayoutState

  if (
    pref?.layout &&
    typeof pref.layout === 'object' &&
    'widgets' in pref.layout
  ) {
    const widgets = (pref.layout as { widgets: LayoutState }).widgets
    initialLayout = { ...widgets }
  } else {
    initialLayout = Object.values(WIDGETS).reduce((acc, widget) => {
      acc[widget.id] = {
        visible: widget.defaultVisible,
        order: widget.defaultOrder,
      }
      return acc
    }, {} as LayoutState)
  }

  const data = {
    totalMembers: workspace.members.length,
    totalAutomations: workspace.automations.length,
    successRate,
    health,
    recentRuns: recentRunsView,
  }

  return (
    <DashboardShell>
      <section className="mb-6 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          {workspace.name} overview
        </h1>
        <p className="text-neutral-text-secondary text-xs">
          Customize your dashboard layout, drag cards, and use AI Coach to get
          insights.
        </p>
      </section>

      <WorkspaceDashboardGrid
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        initialLayout={initialLayout}
        data={data}
      />

      {/* CTA — Full Build Service */}
      <div className="mt-10">
        <BuildRequestCallout workspaceId={workspace.id} />
      </div>
    </DashboardShell>
  )
}

// app/dashboard/page.tsx
import { AiCoachLivePanel } from "@/components/dashboard/ai-coach/AiCoachLivePanel"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Hotspot } from "@/components/onboarding/Hotspot"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"

import { prisma } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import type { Automation, AutomationRun, Workspace } from "@prisma/client"
import Link from "next/link"

type DashboardPageProps = {
  searchParams: { workspace?: string }
}

type AutomationWithRuns = Automation & {
  runs: AutomationRun[]
}

type WorkspaceWithRelations = Workspace & {
  automations: AutomationWithRuns[]
  members: { id: string }[]
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const workspaceSlug = searchParams.workspace

  if (!workspaceSlug) {
    return (
      <DashboardShell>
        <h1 className="h2">Dashboard</h1>
        <p className="text-neutral-text-secondary text-sm">
          Select a workspace to continue.
        </p>
      </DashboardShell>
    )
  }

  const workspace = (await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      automations: {
        include: {
          runs: {
            orderBy: { startedAt: "desc" },
            take: 20,
          },
        },
      },
      members: true,
    },
  })) as WorkspaceWithRelations | null

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
      </DashboardShell>
    )
  }

  const totalAutomations = workspace.automations.length
  const totalMembers = workspace.members.length

  const recentRuns: AutomationRun[] = workspace.automations.flatMap(
    (a: AutomationWithRuns) => a.runs,
  )

  const successRuns = recentRuns.filter((r) => r.status === "SUCCESS").length
  const failedRuns = recentRuns.filter((r) => r.status === "FAILED").length

  const successRate =
    recentRuns.length > 0 ? ((successRuns / recentRuns.length) * 100).toFixed(1) : "0.0"

  const health: "Excellent" | "Good" | "Needs Attention" =
    Number(successRate) >= 95
      ? "Excellent"
      : Number(successRate) >= 80
        ? "Good"
        : "Needs Attention"

  return (
    <DashboardShell>
      {/* HEADER */}
      <section className="mb-10 space-y-1">
        <h1 className="text-neutral-text-primary text-3xl font-semibold">
          Welcome back 👋
        </h1>

        <p className="text-neutral-text-secondary text-sm">
          Workspace: <span className="font-medium">{workspace.name}</span>
        </p>
      </section>

      {/* TOP STATS */}
      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-neutral-text-primary text-sm font-medium">Automations</h3>
          <p className="mt-4 text-4xl font-semibold">{totalAutomations}</p>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Active in this workspace
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="text-neutral-text-primary text-sm font-medium">Members</h3>
          <p className="mt-4 text-4xl font-semibold">{totalMembers}</p>
          <p className="text-neutral-text-secondary mt-1 text-xs">People with access</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-neutral-text-primary text-sm font-medium">
            Workspace Health
          </h3>
          <p
            className={`mt-4 text-3xl font-semibold ${
              health === "Excellent"
                ? "text-emerald-400"
                : health === "Good"
                  ? "text-sky-400"
                  : "text-rose-400"
            }`}
          >
            {health}
          </p>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Last 20 runs: {successRate}% success rate
          </p>
        </Card>
      </div>

      {/* AI COACH LIVE */}
      <section className="mb-12">
        <AiCoachLivePanel workspaceId={workspace.id} />
      </section>

      {/* QUICK ACTIONS + HOTSPOTS */}
      <section className="mb-12 space-y-3">
        <h2 className="text-neutral-text-primary text-lg font-semibold">Quick Actions</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Hotspot id="qa-automations" label="Start by reviewing flows">
            <Link href="/dashboard/automations" className="card hover-lift p-4">
              <h3 className="h4 mb-1">Manage Automations</h3>
              <p className="text-neutral-text-secondary text-xs">
                View, edit, and optimize your automations.
              </p>
            </Link>
          </Hotspot>

          <Hotspot id="qa-analytics" label="Watch performance here">
            <Link href="/dashboard/analytics" className="card hover-lift p-4">
              <h3 className="h4 mb-1">Analytics Dashboard</h3>
              <p className="text-neutral-text-secondary text-xs">
                Trends, run history, success rates, and more.
              </p>
            </Link>
          </Hotspot>

          <Link href="/dashboard/settings" className="card hover-lift p-4">
            <h3 className="h4 mb-1">Workspace Settings</h3>
            <p className="text-neutral-text-secondary text-xs">
              Configure workspace details, plan, and AI settings.
            </p>
          </Link>
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="space-y-4">
        <h2 className="text-neutral-text-primary text-lg font-semibold">
          Recent Activity
        </h2>

        <Card className="space-y-4 p-6">
          {recentRuns.length === 0 ? (
            <p className="text-neutral-text-secondary text-sm">No recent activity.</p>
          ) : (
            recentRuns.map((run: AutomationRun) => {
              const automation = workspace.automations.find((a) =>
                a.runs.some((r) => r.id === run.id),
              )

              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between border-b border-neutral-border pb-3 last:border-none"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Run in{" "}
                      <span className="font-semibold text-brand-primary">
                        {automation?.name ?? "Automation"}
                      </span>
                    </p>
                    <p className="text-neutral-text-secondary mt-1 text-xs">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>

                  <Badge
                    variant={
                      run.status === "SUCCESS"
                        ? "green"
                        : run.status === "FAILED"
                          ? "red"
                          : "default"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              )
            })
          )}
        </Card>
      </section>
    </DashboardShell>
  )
}

// app/dashboard/settings/page.tsx
"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import Link from "next/link"
import { useEffect, useState } from "react"

type OnboardingTaskId =
  | "explore-automations"
  | "view-analytics"
  | "try-ai-coach"
  | "invite-member"

type ProgressResponse = {
  completedTasks: OnboardingTaskId[]
}

const TASKS: {
  id: OnboardingTaskId
  label: string
  description: string
  href: string
  badgeVariant: React.ComponentProps<typeof Badge>["variant"]
}[] = [
  {
    id: "explore-automations",
    label: "Explore your automations",
    description: "Review the starter flows and see how they work.",
    href: "/dashboard/automations",
    badgeVariant: "blue",
  },
  {
    id: "view-analytics",
    label: "Check analytics dashboard",
    description: "Look at run trends, success rates, and workspace health.",
    href: "/dashboard/analytics",
    badgeVariant: "green",
  },
  {
    id: "try-ai-coach",
    label: "Try AI Coach",
    description: "Ask AI Coach to explain or optimize a flow.",
    href: "/dashboard/analytics",
    badgeVariant: "purple",
  },
  {
    id: "invite-member",
    label: "Invite a team member",
    description: "Collaborate with teammates inside your workspace.",
    href: "/dashboard/workspaces",
    badgeVariant: "orange",
  },
]

export default function SettingsPage() {
  const [completed, setCompleted] = useState<OnboardingTaskId[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetch("/api/onboarding/progress")
        if (res.ok) {
          const json: ProgressResponse = await res.json()
          setCompleted(json.completedTasks ?? [])
        }
      } finally {
        setLoading(false)
      }
    }

    loadProgress()
  }, [])

  const progressPercent =
    TASKS.length === 0 ? 0 : Math.round((completed.length / TASKS.length) * 100)

  async function toggleTask(taskId: OnboardingTaskId) {
    const isDone = completed.includes(taskId)
    const next = isDone ? completed.filter((id) => id !== taskId) : [...completed, taskId]

    setCompleted(next)

    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, completed: !isDone }),
    })
  }

  async function resetOnboarding() {
    // Clear all tasks
    setCompleted([])
    for (const t of TASKS) {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: t.id, completed: false }),
      })
    }
  }

  return (
    <DashboardShell>
      <section className="mb-8 space-y-1">
        <h1 className="text-neutral-text-primary text-3xl font-semibold">Settings</h1>
        <p className="text-neutral-text-secondary text-sm">
          Manage your account, workspace, and onboarding experience.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1.2fr]">
        {/* LEFT: General / Workspace settings (placeholder) */}
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-neutral-text-primary mb-2 text-lg font-semibold">
              Account
            </h2>
            <p className="text-neutral-text-secondary text-sm">
              Account details are managed via your Clerk profile.
            </p>
            <Link
              href="/user"
              className="mt-3 inline-flex text-xs text-brand-primary underline"
            >
              Open profile →
            </Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-neutral-text-primary mb-2 text-lg font-semibold">
              Workspace
            </h2>
            <p className="text-neutral-text-secondary text-sm">
              Update workspace name, billing plan, and collaboration settings.
            </p>
            {/* You can add real workspace settings fields here later */}
          </Card>
        </div>

        {/* RIGHT: Onboarding panel */}
        <div className="space-y-4">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-neutral-text-primary text-sm font-semibold">
                  Onboarding Progress
                </h2>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  Track your initial setup steps across Skillify.
                </p>
              </div>
              <Badge variant={progressPercent === 100 ? "green" : "brand"}>
                {progressPercent === 100 ? "Completed" : "In progress"}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-neutral-text-secondary text-xs">
                  {completed.length}/{TASKS.length} steps completed
                </span>
                <span className="text-neutral-text-secondary text-xs">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-900/5 dark:bg-neutral-50/10">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {loading ? (
              <p className="text-neutral-text-secondary mt-2 text-xs">
                Loading onboarding status...
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {TASKS.map((task) => {
                  const isDone = completed.includes(task.id)
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-col">
                        <span
                          className={`font-medium ${
                            isDone
                              ? "text-emerald-500 dark:text-emerald-300"
                              : "text-neutral-text-primary"
                          }`}
                        >
                          {task.label}
                        </span>
                        <span className="text-neutral-text-secondary">
                          {task.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={task.href}
                          className="text-[11px] text-brand-primary underline"
                        >
                          Open
                        </Link>
                        <button
                          onClick={() => toggleTask(task.id)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            isDone
                              ? "border-emerald-500 text-emerald-600 dark:text-emerald-300"
                              : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-200"
                          }`}
                        >
                          {isDone ? "Completed" : "Mark done"}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={resetOnboarding}
                className="text-neutral-text-secondary text-[11px] underline"
              >
                Restart onboarding
              </button>
              <Link
                href="/onboarding"
                className="text-[11px] text-brand-primary underline"
              >
                Open onboarding page →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}

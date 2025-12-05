"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import Link from "next/link"
import { useEffect, useState } from "react"

type OnboardingResponse = {
  workspace?: {
    id: string
    slug: string
    name: string
  }
  tier: "basic" | "pro" | "elite"
  bootstrap?: boolean
}

type TaskId = "explore-automations" | "view-analytics" | "try-ai-coach" | "invite-member"

type ProgressResponse = {
  completedTasks: TaskId[]
}

const TASKS: {
  id: TaskId
  label: string
  description: string
  href: string
  badgeVariant: React.ComponentProps<typeof Badge>["variant"]
  step: string
}[] = [
  {
    id: "explore-automations",
    label: "Explore Your Automations",
    description: "Review the starter flows and learn how they work.",
    href: "/dashboard/automations",
    badgeVariant: "blue",
    step: "Step 1",
  },
  {
    id: "view-analytics",
    label: "Check Analytics Dashboard",
    description: "Explore run trends, success rates, and workspace health.",
    href: "/dashboard/analytics",
    badgeVariant: "green",
    step: "Step 2",
  },
  {
    id: "try-ai-coach",
    label: "Try AI Coach",
    description: "Let AI Coach analyze, explain, or optimize a flow.",
    href: "/dashboard/analytics", // or your actual AI Coach page
    badgeVariant: "purple",
    step: "Step 3",
  },
  {
    id: "invite-member",
    label: "Invite a Team Member",
    description: "Collaborate with teammates inside your workspace.",
    href: "/dashboard/workspaces",
    badgeVariant: "orange",
    step: "Step 4",
  },
]

export default function OnboardingPage() {
  const [data, setData] = useState<OnboardingResponse | null>(null)
  const [completed, setCompleted] = useState<TaskId[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  useEffect(() => {
    async function bootstrapAndLoad() {
      // 1) Ensure workspace + tier
      const res = await fetch("/api/workspaces/bootstrap", {
        method: "POST",
      })
      const json: OnboardingResponse & { bootstrap?: boolean } = await res.json()
      setData(json)

      if (!json.bootstrap && json.workspace?.slug) {
        // If they already had a workspace → skip onboarding
        window.location.href = `/dashboard/workspaces/${json.workspace.slug}`
        return
      }

      // 2) Load onboarding progress
      setLoadingTasks(true)
      const progRes = await fetch("/api/onboarding/progress")
      if (progRes.ok) {
        const progJson: ProgressResponse = await progRes.json()
        setCompleted(progJson.completedTasks ?? [])
      }
      setLoadingTasks(false)
    }

    bootstrapAndLoad()
  }, [])

  async function toggleTask(taskId: TaskId) {
    const isDone = completed.includes(taskId)
    setCompleted((prev) =>
      isDone ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    )

    // Persist to API
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, completed: !isDone }),
    })
  }

  if (!data) {
    return (
      <div className="text-neutral-text-secondary flex min-h-screen items-center justify-center">
        Setting up your workspace...
      </div>
    )
  }

  const tierLabel =
    data.tier === "elite" ? "Elite" : data.tier === "pro" ? "Pro" : "Starter"

  const tierColor =
    data.tier === "elite"
      ? "bg-purple-600 text-white"
      : data.tier === "pro"
        ? "bg-blue-600 text-white"
        : "bg-gray-300 text-gray-900"

  const progressPercent =
    TASKS.length === 0 ? 0 : Math.round((completed.length / TASKS.length) * 100)

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      {/* HEADER */}
      <section className="mb-8 space-y-3">
        <h1 className="text-neutral-text-primary text-4xl font-semibold">
          Welcome to Skillify 👋
        </h1>

        <p className="text-neutral-text-secondary text-sm">
          Your workspace has been created and pre-configured based on your subscription
          tier.
        </p>

        <span className={`inline-block rounded-full px-3 py-1 text-xs ${tierColor}`}>
          {tierLabel} Plan
        </span>
      </section>

      {/* WORKSPACE SUMMARY */}
      <Card className="mb-8 p-6">
        <h2 className="text-neutral-text-primary mb-3 text-lg font-semibold">
          Your Workspace
        </h2>

        <p className="text-neutral-text-secondary text-sm">
          <span className="text-neutral-text-primary font-medium">Name:</span>{" "}
          {data.workspace?.name}
        </p>

        <p className="text-neutral-text-secondary mt-1 text-sm">
          <span className="text-neutral-text-primary font-medium">Slug:</span>{" "}
          {data.workspace?.slug}
        </p>

        <p className="text-neutral-text-secondary mt-3 text-sm">
          {data.tier === "elite"
            ? "Full AI-enabled demo flows, advanced examples, and analytics."
            : data.tier === "pro"
              ? "Medium-level starter automations and run history."
              : "A simple starter automation to help you begin quickly."}
        </p>
      </Card>

      {/* PROGRESS BAR */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-neutral-text-primary text-sm font-semibold">
            Onboarding Progress
          </h2>
          <span className="text-neutral-text-secondary text-xs">
            {completed.length}/{TASKS.length} completed ({progressPercent}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-900/5 dark:bg-neutral-50/10">
          <div
            className="h-full rounded-full bg-brand-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* CHECKLIST */}
      <section className="mb-16 space-y-4">
        <h2 className="text-neutral-text-primary text-lg font-semibold">
          Getting Started Checklist
        </h2>

        {loadingTasks && (
          <p className="text-neutral-text-secondary text-xs">Loading your progress...</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {TASKS.map((task) => {
            const isDone = completed.includes(task.id)
            return (
              <Card
                key={task.id}
                className={`space-y-2 p-5 transition ${
                  isDone ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{task.label}</p>
                    <p className="text-neutral-text-secondary text-xs">
                      {task.description}
                    </p>
                  </div>
                  <Badge variant={task.badgeVariant}>{task.step}</Badge>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <Link
                    href={task.href}
                    className="text-xs font-medium text-brand-primary underline"
                  >
                    Open →
                  </Link>

                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      isDone
                        ? "border-emerald-500 text-emerald-600 dark:text-emerald-300"
                        : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-200"
                    }`}
                  >
                    {isDone ? "Completed" : "Mark done"}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <div className="flex justify-center">
        <Link
          href={`/dashboard/workspaces/${data.workspace?.slug}`}
          className="hover:bg-brand-primary/90 rounded-xl bg-brand-primary px-6 py-3 font-medium text-white"
        >
          Go to Dashboard →
        </Link>
      </div>
    </div>
  )
}

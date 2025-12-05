// components/onboarding/OnboardingTasks.tsx
"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"

type OnboardingTask = {
  id: "automations" | "analytics" | "ai-coach" | "invite"
  label: string
  description: string
  href: string
  badge: "blue" | "green" | "purple" | "orange"
}

const TASKS: OnboardingTask[] = [
  {
    id: "automations",
    label: "Explore Automations",
    description: "Review your starter flows and see how they operate.",
    href: "/dashboard/automations",
    badge: "blue",
  },
  {
    id: "analytics",
    label: "View Analytics",
    description: "Check success rate, run trends, and workspace health.",
    href: "/dashboard/analytics",
    badge: "green",
  },
  {
    id: "ai-coach",
    label: "Try AI Coach",
    description: "Ask the AI Coach to analyze or optimize a flow.",
    href: "/dashboard/ai",
    badge: "purple",
  },
  {
    id: "invite",
    label: "Invite a Team Member",
    description: "Collaborate with teammates inside your workspace.",
    href: "/dashboard/workspaces",
    badge: "orange",
  },
]

export default function OnboardingTasks() {
  const [completed, setCompleted] = useState<string[]>([])

  useEffect(() => {
    const saved = localStorage.getItem("skillify:onboarding")
    if (saved) setCompleted(JSON.parse(saved))
  }, [])

  const toggle = async (id: string) => {
    const next = completed.includes(id)
      ? completed.filter((t) => t !== id)
      : [...completed, id]

    setCompleted(next)
    localStorage.setItem("skillify:onboarding", JSON.stringify(next))

    // Optional later:
    // await fetch("/api/onboarding/progress", { method: "POST", ... })
  }

  const progress = Math.round((completed.length / TASKS.length) * 100)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-neutral-text-primary font-semibold">Getting Started</h3>
        <Badge variant={progress === 100 ? "green" : "brand"}>
          {progress === 100 ? "Completed" : `${progress}%`}
        </Badge>
      </div>

      <div className="space-y-4">
        {TASKS.map((task) => {
          const isDone = completed.includes(task.id)

          return (
            <Card
              key={task.id}
              className={`border p-5 transition ${
                isDone
                  ? "border-green-500/40 bg-green-50 dark:bg-green-950/30"
                  : "bg-neutral-card-light dark:bg-neutral-card-dark border-neutral-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-neutral-text-primary font-semibold">
                      {task.label}
                    </p>
                    <Badge variant={task.badge}>{isDone ? "Done" : "Step"}</Badge>
                  </div>
                  <p className="text-neutral-text-secondary text-xs">
                    {task.description}
                  </p>
                </div>

                <button
                  onClick={() => toggle(task.id)}
                  className={`rounded-full p-2 transition ${
                    isDone
                      ? "bg-green-600 text-white"
                      : "text-neutral-text-secondary bg-neutral-200 dark:bg-neutral-800"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>

              <a
                href={task.href}
                className="mt-3 block text-xs font-medium text-brand-primary underline"
              >
                Open →
              </a>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

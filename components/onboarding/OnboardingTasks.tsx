// components/onboarding/OnboardingTasks.tsx
'use client'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type OnboardingTask = {
  id: 'automations' | 'analytics' | 'ai-coach' | 'invite'
  label: string
  description: string
  href: string
  badge: 'blue' | 'green' | 'purple' | 'orange'
}

const TASKS: OnboardingTask[] = [
  {
    id: 'automations',
    label: 'Explore Automations',
    description: 'Review your starter flows and see how they operate.',
    href: '/dashboard/automations',
    badge: 'blue',
  },
  {
    id: 'analytics',
    label: 'View Analytics',
    description: 'Check success rate, run trends, and workspace health.',
    href: '/dashboard/analytics',
    badge: 'green',
  },
  {
    id: 'ai-coach',
    label: 'Try AI Coach',
    description: 'Ask the AI Coach to analyze or optimize a flow.',
    href: '/dashboard/ai',
    badge: 'purple',
  },
  {
    id: 'invite',
    label: 'Invite a Team Member',
    description: 'Collaborate with teammates inside your workspace.',
    href: '/dashboard/workspaces',
    badge: 'orange',
  },
]

export default function OnboardingTasks({
  workspaceSlug,
  onDismiss,
}: {
  workspaceSlug: string
  onDismiss?: () => void
}) {
  const router = useRouter()
  const [completed, setCompleted] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(`skillify:onboarding:${workspaceSlug}`)
    if (saved) setCompleted(JSON.parse(saved))
    const savedCollapsed = localStorage.getItem(
      `skillify:onboarding:${workspaceSlug}:collapsed`,
    )
    if (savedCollapsed) setCollapsed(savedCollapsed === 'true')
    const savedDismissed = localStorage.getItem(
      `skillify:onboarding:${workspaceSlug}:dismissed`,
    )
    if (savedDismissed) setDismissed(savedDismissed === 'true')
  }, [])

  const toggle = async (id: string) => {
    const next = completed.includes(id)
      ? completed.filter((t) => t !== id)
      : [...completed, id]

    setCompleted(next)
    localStorage.setItem(
      `skillify:onboarding:${workspaceSlug}`,
      JSON.stringify(next),
    )
    if (next.length === TASKS.length) {
      setCollapsed(true)
      localStorage.setItem(
        `skillify:onboarding:${workspaceSlug}:collapsed`,
        'true',
      )
    }

    // Optional later:
    // await fetch("/api/onboarding/progress", { method: "POST", ... })
  }

  const progress = Math.round((completed.length / TASKS.length) * 100)

  const tasksWithWorkspace = useMemo(
    () =>
      TASKS.map((task) => ({
        ...task,
        href: (() => {
          const normalized = task.href.replace(/^\/dashboard\/?/, '')
          return `/dashboard/${workspaceSlug}/${normalized.replace(/^\//, '')}`
        })(),
      })),
    [workspaceSlug],
  )
  const visibleTasks = tasksWithWorkspace.filter(
    (task) => !completed.includes(task.id),
  )

  if (dismissed) {
    return null
  }

  if (collapsed) {
    return (
      <button
        className="bg-neutral-card-light/90 text-neutral-text-primary hover:border-neutral-border-strong dark:bg-neutral-card-dark/70 flex w-full items-center justify-between rounded-lg border border-neutral-border px-3 py-2 text-sm shadow-sm transition"
        onClick={() => {
          setCollapsed(false)
          localStorage.setItem(
            `skillify:onboarding:${workspaceSlug}:collapsed`,
            'false',
          )
        }}
      >
        <span className="font-semibold">Getting Started</span>
        <span className="text-neutral-text-secondary text-xs">Show</span>
      </button>
    )
  }

  return (
    <div className="border-neutral-border/70 bg-neutral-card-light/85 dark:bg-neutral-card-dark/80 space-y-3 rounded-lg border p-3 text-xs shadow-lg backdrop-blur transition duration-150 ease-out">
      <div className="flex items-center justify-between">
        <h3 className="text-neutral-text-primary text-sm font-semibold">
          Getting Started
        </h3>
        <Badge variant={progress === 100 ? 'green' : 'brand'}>
          {progress === 100 ? 'Completed' : `${progress}%`}
        </Badge>
      </div>

      <div className="space-y-2">
        {visibleTasks.map((task) => (
          <Card
            key={task.id}
            className="bg-neutral-card-light dark:bg-neutral-card-dark border border-neutral-border p-4 transition"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-neutral-text-primary text-sm font-semibold">
                    {task.label}
                  </p>
                  <Badge variant={task.badge}>Step</Badge>
                </div>
                <p className="text-neutral-text-secondary text-xs">
                  {task.description}
                </p>
              </div>

              <button
                onClick={() => toggle(task.id)}
                className="text-neutral-text-secondary rounded-full bg-neutral-200 p-2 transition hover:bg-neutral-300 dark:bg-neutral-800"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>

            <Link
              href={task.href}
              className="mt-2 block text-xs font-medium text-brand-primary underline"
              onClick={(e) => {
                e.preventDefault()
                router.push(task.href)
              }}
            >
              Open →
            </Link>
          </Card>
        ))}
        {visibleTasks.length === 0 && (
          <div className="rounded-lg border border-green-500/40 bg-green-50 p-3 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-100">
            All tasks completed.
          </div>
        )}
      </div>

      <div className="text-neutral-text-secondary flex items-center justify-between pt-1 text-[11px]">
        <span>
          {completed.length} of {TASKS.length} steps completed
        </span>
        <button
          className="text-[11px] font-semibold text-brand-primary underline"
          onClick={() => {
            setDismissed(true)
            localStorage.setItem(
              `skillify:onboarding:${workspaceSlug}:dismissed`,
              'true',
            )
            onDismiss?.()
          }}
        >
          Hide Getting Started
        </button>
      </div>
    </div>
  )
}

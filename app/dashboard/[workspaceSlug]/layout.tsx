'use client'

import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'

import { SidebarNav } from '@/components/dashboard/SidebarNav'
import { SIDEBAR_ITEMS } from '@/components/dashboard/sidebar-items'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { UserButton } from '@clerk/nextjs'

import WorkspaceSwitcher from '@/components/workspaces/WorkspaceSwitcher'
import CommandPalette from '@/components/command/CommandPalette'
import HelpPanel from '@/components/help/HelpPanel'
import OnboardingTour from '@/components/onboarding/OnboardingTour'
import OnboardingTasks from '@/components/onboarding/OnboardingTasks'
import AIOnboardingPanel from '@/components/onboarding/AIOnboardingPanel'
import { RouteTransition } from '@/components/ui/RouteTransition'

import { AdminTopNav } from '@/components/admin/AdminTopNav'
import { getWorkspaceRole } from '@/lib/auth/getWorkspaceRole'

// --- API HELPERS ---
async function fetchWorkspaces() {
  const res = await fetch('/api/workspaces')
  return res.ok ? res.json() : []
}

async function fetchMetrics(workspaceId: string) {
  const res = await fetch(`/api/analytics/summary?workspaceId=${workspaceId}`)
  return res.ok ? res.json() : {}
}

async function fetchPlan() {
  const res = await fetch('/api/auth/plan')
  const data = res.ok ? await res.json() : {}
  return data.plan ?? 'Free'
}

type Workspace = {
  id: string
  name: string
  slug: string
}

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { workspaceSlug: string }
}) {
  const { workspaceSlug } = params

  const [mobileOpen, setMobileOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [current, setCurrent] = useState<Workspace | null>(null)

  const [role, setRole] = useState<'owner' | 'admin' | 'member' | null>(null)
  const [metrics, setMetrics] = useState<any>({})
  const [plan, setPlan] = useState<'Free' | 'Basic' | 'Pro' | 'Elite'>('Free')

  useEffect(() => {
    async function load() {
      const ws = await fetchWorkspaces()
      setWorkspaces(ws)

      const currentWs =
        ws.find((w: Workspace) => w.slug === workspaceSlug) ?? null
      setCurrent(currentWs)

      if (currentWs) {
        const userRole = await getWorkspaceRole(currentWs.id)
        setRole(userRole.toLowerCase() as 'owner' | 'admin' | 'member')

        setMetrics(await fetchMetrics(currentWs.id))
        setPlan(await fetchPlan())
      }
    }
    load()
  }, [workspaceSlug])

  return (
    <div className="text-neutral-text-primary flex min-h-screen bg-neutral-light dark:bg-neutral-dark">
      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 sm:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed z-40 h-full transition-transform duration-300 sm:relative ${mobileOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
          }`}
      >
        <SidebarNav
          items={SIDEBAR_ITEMS}
          role={role ?? 'member'}
          workspaceSlug={workspaceSlug}
          plan={plan}
        />
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="bg-neutral-light/80 dark:bg-neutral-dark/80 flex h-14 items-center justify-between gap-4 border-b border-neutral-border px-4 backdrop-blur sm:px-6">
          <button className="sm:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-3">
            <Breadcrumbs />
            <div className="ml-2 hidden items-center gap-2 md:flex">
              <span className="bg-neutral-card-dark/40 rounded-lg border border-neutral-border px-2 py-0.5 text-xs">
                Workspace
              </span>
              <WorkspaceSwitcher workspaces={workspaces} current={current} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {current && (role === 'owner' || role === 'admin') && (
              <AdminTopNav workspace={current} role={role} />
            )}
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>

      <CommandPalette workspaces={workspaces} current={current} />
      <HelpPanel />
      <OnboardingTour />
      <OnboardingTasks />
      <AIOnboardingPanel />
    </div>
  )
}

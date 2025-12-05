// app/dashboard/layout.tsx
"use client"

import { UserButton } from "@clerk/nextjs"
import { Menu } from "lucide-react"
import { useEffect, useState } from "react"

// ========== SIDEBAR SYSTEM ==========
import { SIDEBAR_ITEMS } from "@/components/dashboard/sidebar-items"
import { SidebarNav } from "@/components/dashboard/SidebarNav"

// ========== TOP BAR UI ==========
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

// ========== WORKSPACE SWITCHER ==========
import WorkspaceSwitcher from "@/components/workspaces/WorkspaceSwitcher"

// ========== ENTERPRISE PANELS ==========
import { AICoachLiveSidebar } from "@/components/dashboard/AICoachLiveSidebar"

// Command Center (Raycast-style)
import CommandCenterPalette from "@/components/command-center/CommandCenterPalette"
import {
  CommandCenterProvider,
  CommandCenterTrigger,
} from "@/components/command-center/CommandCenterProvider"

// Help + Onboarding
import HelpPanel from "@/components/help/HelpPanel"
import AIOnboardingPanel from "@/components/onboarding/AIOnboardingPanel"
import OnboardingTasks from "@/components/onboarding/OnboardingTasks"
import OnboardingTour from "@/components/onboarding/OnboardingTour"

// Page transitions
import { RouteTransition } from "@/components/ui/RouteTransition"

// TEMP placeholders
function TopSearch() {
  return (
    <div
      data-tour="search"
      className="hidden items-center rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 md:flex"
    >
      Search…
    </div>
  )
}

function Notifications() {
  return (
    <button className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
      Notifications
    </button>
  )
}

// FETCH WORKSPACES
interface Workspace {
  id: string
  name: string
  slug: string
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch("/api/workspaces")
  if (!res.ok) return []
  const data = (await res.json()) as { data?: Workspace[] } | Workspace[]
  if (Array.isArray(data)) return data
  return data.data ?? []
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [current, setCurrent] = useState<Workspace | null>(null)

  // Load workspaces on mount
  useEffect(() => {
    void (async () => {
      const ws = await fetchWorkspaces()
      setWorkspaces(ws)
      setCurrent(ws[0] ?? null)
    })()
  }, [])

  // Mobile sidebar handler
  useEffect(() => {
    const handler = () => setMobileOpen(true)
    window.addEventListener("skillify-open-sidebar", handler)
    return () => window.removeEventListener("skillify-open-sidebar", handler)
  }, [])

  return (
    <CommandCenterProvider>
      <div className="text-neutral-text-primary flex min-h-screen bg-neutral-light dark:bg-neutral-dark">
        {/* =======================
            MOBILE OVERLAY
        ======================== */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 sm:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* =======================
            SIDEBAR
        ======================== */}
        <aside
          data-tour="sidebar"
          className={`fixed z-40 h-full transition-transform duration-300 sm:relative ${mobileOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"} `}
        >
          <SidebarNav items={SIDEBAR_ITEMS} />
        </aside>

        {/* =======================
            MAIN COLUMN
        ======================== */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* =======================
              TOP BAR
          ======================== */}
          <header className="bg-neutral-light/80 dark:bg-neutral-dark/80 flex h-14 items-center justify-between gap-4 border-b border-neutral-border px-4 backdrop-blur sm:px-6">
            {/* Mobile menu button */}
            <button className="sm:hidden" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>

            {/* Breadcrumbs + Workspace */}
            <div className="flex items-center gap-3" data-tour="cmd-palette">
              <Breadcrumbs />

              <div
                className="ml-2 hidden items-center gap-2 md:flex"
                data-tour="workspace-switcher"
              >
                <span className="bg-neutral-card-dark/40 rounded-lg border border-neutral-border px-2 py-0.5 text-xs">
                  Workspace
                </span>

                <WorkspaceSwitcher workspaces={workspaces} current={current} />
              </div>
            </div>

            {/* Search */}
            <TopSearch />

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <CommandCenterTrigger />
              <ThemeToggle />
              <Notifications />
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          {/* =======================
              CONTENT + LIVE COACH
          ======================== */}
          <div className="flex w-full">
            <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
              <RouteTransition>{children}</RouteTransition>
            </main>

            <AICoachLiveSidebar data-tour="ai-coach" />
          </div>
        </div>

        {/* =======================
            COMMAND CENTER + HELP
        ======================== */}
        <CommandCenterPalette workspaces={workspaces} current={current} />
        <HelpPanel />
        <OnboardingTour />
        <OnboardingTasks />
        <AIOnboardingPanel />
      </div>
    </CommandCenterProvider>
  )
}

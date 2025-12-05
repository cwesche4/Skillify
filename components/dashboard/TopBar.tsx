// components/dashboard/TopBar.tsx
"use client"

import { Input } from "@/components/ui/Input"
import WorkspaceSwitcher from "@/components/workspaces/WorkspaceSwitcher"
import { cn } from "@/lib/utils"
import { Bell, Search } from "lucide-react"

export function TopBar({
  workspaces,
  current,
}: {
  workspaces: { id: string; name: string; slug: string }[]
  current: { id: string; name: string; slug: string } | null
}) {
  return (
    <header className="navbar">
      {/* Left: workspace switcher */}
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher workspaces={workspaces} current={current} />
      </div>

      {/* Center: search */}
      <div className="mx-6 hidden max-w-xl flex-1 md:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            className={cn(
              "rounded-xl border-slate-800 bg-slate-900 py-2 pl-9 pr-3",
              "text-sm placeholder:text-slate-500",
            )}
            placeholder="Search automations, contacts, runs…"
          />
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        <button className="relative rounded-xl border border-transparent p-2 hover:border-slate-800 hover:bg-slate-900">
          <Bell className="h-4 w-4 text-slate-300" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white">
            3
          </span>
        </button>

        <button className="profile-menu">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white">
            C
          </div>
          <div className="hidden flex-col items-start sm:flex">
            <span className="text-neutral-text-secondary text-xs">Logged in as</span>
            <span className="text-neutral-text-primary text-sm font-medium">Corbin</span>
          </div>
        </button>
      </div>
    </header>
  )
}

// components/command-center/CommandCenterList.tsx
"use client"

import { cn } from "@/lib/utils"
import { useCommandCenter } from "./CommandCenterProvider"
import type { CommandItem } from "./types"

import {
  BarChart3,
  Bot,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  Workflow,
} from "lucide-react"

// FIXED ICON DICTIONARY TYPE
const ICONS: Record<string, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  automations: Workflow,
  analytics: BarChart3,
  settings: Settings,
  team: Users,
  billing: CreditCard,
  ai: Bot,
  help: HelpCircle,
  search: Search,
}

export interface CommandCenterListProps {
  items: CommandItem[]
  loading?: boolean
  onSelect?: (item: CommandItem) => void
}

export function CommandCenterList({ items, loading, onSelect }: CommandCenterListProps) {
  const { setOpen } = useCommandCenter()

  if (loading) {
    return <div className="px-3 py-4 text-xs text-slate-500">Searching…</div>
  }

  if (!items.length) {
    return (
      <div className="px-3 py-4 text-xs text-slate-500">
        No results. Try a different search.
      </div>
    )
  }

  // group by "group"
  const grouped = items.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    const key = cmd.group ?? "Other"
    if (!acc[key]) acc[key] = []
    acc[key].push(cmd)
    return acc
  }, {})

  const handleSelect = (item: CommandItem) => {
    // Close command center
    setOpen(false)

    // Navigate if href
    if (item.href) {
      window.location.href = item.href
    }

    // Fire custom onboarding action
    if (item.type === "onboarding" && item.meta?.action === "open_onboarding") {
      window.dispatchEvent(new CustomEvent("skillify-open-tour"))
    }

    if (onSelect) onSelect(item)
  }

  return (
    <div className="max-h-[420px] overflow-y-auto py-2 text-xs">
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group} className="mb-3">
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {group}
          </div>

          <div className="space-y-1">
            {groupItems.map((cmd) => {
              const Icon = ICONS[cmd.icon] ?? Search
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => handleSelect(cmd)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left",
                    "hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-600",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-200">
                      <Icon size={14} />
                    </span>

                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium text-slate-100">
                        {cmd.label}
                      </span>
                      {cmd.subtitle && (
                        <span className="text-[10px] text-slate-400">{cmd.subtitle}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cmd.badge && (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-300">
                        {cmd.badge}
                      </span>
                    )}

                    {cmd.shortcut && (
                      <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default CommandCenterList

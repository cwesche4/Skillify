"use client"

import { semanticSearch } from "@/lib/ai/search"
import { AnimatePresence, motion } from "framer-motion"
import Fuse from "fuse.js"
import {
  BarChart3,
  FolderPlus,
  Inbox,
  LifeBuoy,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useEffect, useState } from "react"

//
// TYPES
//
type Workspace = {
  id: string
  name: string
  slug: string
}

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>

type CommandKind = "workspace" | "page" | "help" | "ai" | "action"

export type CommandItem = {
  id: string
  type: CommandKind
  label: string
  subtitle?: string
  href?: string
  action?: () => void
  shortcut?: string
  icon?: IconType
  group: string
  tags?: string[]
}

//
// CONSTANTS
//
const PINNED_IDS: string[] = ["page:automations", "page:analytics", "ai:teach"]

const HEATMAP_KEY = "skillify-cmd-heatmap"
const HISTORY_KEY = "skillify-cmd-history"

//
// HEATMAP HELPERS
//
function recordHeat(key: string) {
  const raw = localStorage.getItem(HEATMAP_KEY)
  const data: Record<string, number> = raw ? JSON.parse(raw) : {}
  data[key] = (data[key] ?? 0) + 1
  localStorage.setItem(HEATMAP_KEY, JSON.stringify(data))
}

function readHeat(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HEATMAP_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

//
// COMPONENT
//
export default function CommandPalette({ workspaces }: { workspaces: Workspace[] }) {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [results, setResults] = useState<CommandItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [historyIds, setHistoryIds] = useState<string[]>([])
  const [suggestedLabel, setSuggestedLabel] = useState<string | null>(null)

  const heatmap = readHeat()

  //
  // FUZZY SEARCH
  //
  const fuse = new Fuse<Workspace>(workspaces, {
    keys: ["name", "slug"],
    threshold: 0.3,
  })

  //
  // WORKSPACE COMMANDS
  //
  const workspaceCommands: CommandItem[] = workspaces.map(
    (w: Workspace): CommandItem => ({
      id: `workspace:${w.slug}`,
      type: "workspace",
      label: w.name,
      subtitle: "Switch workspace",
      href: `/dashboard/${w.slug}`,
      icon: Inbox,
      group: "Workspaces",
      tags: ["workspace"],
    }),
  )

  //
  // STATIC COMMANDS
  //
  const ALL_ITEMS: CommandItem[] = [
    // Workspaces
    ...workspaceCommands,

    // Navigation
    {
      id: "page:automations",
      type: "page",
      label: "Automations",
      subtitle: "Manage automation flows",
      href: "/dashboard/automations",
      icon: Workflow,
      group: "Navigation",
      shortcut: "G A",
      tags: ["flows", "builder"],
    },
    {
      id: "page:analytics",
      type: "page",
      label: "Analytics",
      subtitle: "Performance & metrics",
      href: "/dashboard/analytics",
      icon: BarChart3,
      group: "Navigation",
      shortcut: "G N",
      tags: ["metrics", "reports"],
    },
    {
      id: "page:settings",
      type: "page",
      label: "Settings",
      subtitle: "Preferences & workspace config",
      href: "/dashboard/settings",
      icon: Settings,
      group: "Navigation",
      shortcut: "G S",
      tags: ["account", "team"],
    },

    // Actions
    {
      id: "action:create-workspace",
      type: "action",
      label: "Create Workspace",
      subtitle: "Set up a new workspace",
      icon: FolderPlus,
      group: "Quick Actions",
      shortcut: "W",
      tags: ["organization"],
      action: () => window.dispatchEvent(new CustomEvent("open-create-workspace")),
    },
    {
      id: "action:create-automation",
      type: "action",
      label: "Create Automation",
      subtitle: "Start a new flow",
      icon: Plus,
      group: "Quick Actions",
      shortcut: "A",
      tags: ["flow", "builder"],
      action: () => window.location.assign("/dashboard/automations/new"),
    },

    // Support
    {
      id: "help:panel",
      type: "help",
      label: "Open Help Panel",
      subtitle: "Shortcuts, docs, tips",
      icon: LifeBuoy,
      group: "Support",
      tags: ["help", "docs"],
      action: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })),
    },

    // AI
    {
      id: "ai:teach",
      type: "ai",
      label: "Teach Me Skillify (AI Guide)",
      subtitle: "Learn Skillify step-by-step",
      icon: Sparkles,
      group: "AI",
      shortcut: "AI",
      tags: ["ai", "guide", "training"],
      action: () => window.dispatchEvent(new CustomEvent("open-ai-onboarding")),
    },
  ]

  //
  // LOAD HISTORY
  //
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        setHistoryIds(parsed)
      }
    } catch {}
  }, [])

  //
  // CONTEXT SCORE
  //
  function contextScore(item: CommandItem): number {
    let score = 0

    if (PINNED_IDS.includes(item.id)) score += 3
    if (historyIds.includes(item.id)) score += 2

    const heat = heatmap[item.id] ?? 0
    score += Math.min(heat, 4)

    if (pathname.includes("automations") && item.label.includes("Automation")) score += 2

    if (pathname.includes("analytics") && item.label.includes("Analytics")) score += 2

    return score
  }

  //
  // NO QUERY → SHOW PINNED + RECENT + CONTEXT
  //
  useEffect(() => {
    if (query.trim()) return

    const map = new Map(ALL_ITEMS.map((i) => [i.id, i]))

    const pinned = PINNED_IDS.map((id) => map.get(id)).filter(Boolean) as CommandItem[]

    const recent = historyIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .filter((i) => !pinned.some((p) => p.id === i!.id)) as CommandItem[]

    const rest = ALL_ITEMS.filter(
      (i) => !pinned.some((p) => p.id === i.id) && !recent.some((r) => r.id === i.id),
    )

    const final = [...pinned, ...recent, ...rest].sort(
      (a, b) => contextScore(b) - contextScore(a),
    )

    setResults(final)
    setActiveIndex(0)
    setLoadingAI(false)
  }, [query, historyIds, pathname, heatmap])

  //
  // SEARCH
  //
  useEffect(() => {
    if (!query.trim()) return

    let mounted = true

    const run = async () => {
      setLoadingAI(true)

      // fuzzy workspace match
      const fuzzyWs = fuse.search(query).map((res) => res.item)
      const fuzzyCommands: CommandItem[] = fuzzyWs.map((w) => ({
        id: `workspace:${w.slug}`,
        type: "workspace",
        label: w.name,
        subtitle: "Switch workspace",
        href: `/dashboard/${w.slug}`,
        icon: Inbox,
        group: "Workspaces",
        tags: ["workspace"],
      }))

      // AI ranking
      const aiRanked: CommandItem[] = await semanticSearch(query, ALL_ITEMS)

      const merged: CommandItem[] = [...aiRanked, ...fuzzyCommands].reduce(
        (acc: CommandItem[], item: CommandItem) => {
          if (!acc.find((x) => x.id === item.id)) acc.push(item)
          return acc
        },
        [],
      )

      const sorted = merged.sort((a, b) => contextScore(b) - contextScore(a))

      if (mounted) {
        setResults(sorted)
        setActiveIndex(0)
        setLoadingAI(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  //
  // SUGGESTED LABEL
  //
  useEffect(() => {
    if (query.trim() && results.length > 0) {
      setSuggestedLabel(results[0].label)
    } else {
      setSuggestedLabel(null)
    }
  }, [query, results])

  //
  // EXECUTE COMMAND
  //
  function execute(item: CommandItem) {
    setOpen(false)

    recordHeat(item.id)

    const updated = [item.id, ...historyIds.filter((x) => x !== item.id)].slice(0, 10)

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    setHistoryIds(updated)

    if (item.href) window.location.href = item.href
    if (item.action) item.action()
  }

  //
  // KEYBOARD
  //
  useEffect(() => {
    function keyHandler(e: KeyboardEvent) {
      // ⌘K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }

      if (!open) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((idx) => Math.min(idx + 1, results.length - 1))
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((idx) => Math.max(idx - 1, 0))
      }

      if (e.key === "Enter") {
        const item = results[activeIndex]
        if (item) execute(item)
      }

      if (e.key === "Escape") {
        setOpen(false)
      }

      if (e.key === "Tab" && suggestedLabel) {
        e.preventDefault()
        setQuery(suggestedLabel)
      }
    }

    window.addEventListener("keydown", keyHandler)
    return () => window.removeEventListener("keydown", keyHandler)
  }, [open, results, activeIndex, suggestedLabel])

  const activeItem: CommandItem | undefined = results[activeIndex]

  //
  // RENDER
  //
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 pt-24"
          data-tour="cmd-palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-neutral-card-light w-full max-w-xl rounded-xl border border-neutral-border p-4 shadow-2xl dark:bg-neutral-dark"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            {/* Search Input */}
            <div className="relative">
              <Search className="text-neutral-text-secondary absolute left-3 top-3 h-4 w-4" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workspaces, pages, actions… (⌘K)"
                className="dark:bg-neutral-card-dark text-neutral-text-primary w-full rounded-lg border border-neutral-border bg-neutral-light py-2 pl-10 pr-3"
              />
            </div>

            {query && suggestedLabel && suggestedLabel !== query && (
              <div className="text-neutral-text-secondary mt-1 text-[12px]">
                Suggested: <span className="font-medium">{suggestedLabel}</span>{" "}
                <span className="opacity-70">(press Tab)</span>
              </div>
            )}

            {loadingAI && (
              <div className="text-neutral-text-secondary mt-2 px-2 text-xs">
                ✨ AI is analyzing your intent…
              </div>
            )}

            {/* Two-Column Layout (List + Preview) */}
            <div className="mt-3 grid max-h-80 grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-3">
              {/* Left list */}
              <div className="overflow-y-auto pr-1">
                {results.map((item: CommandItem, idx: number) => {
                  const Icon = item.icon
                  const active = idx === activeIndex

                  return (
                    <button
                      key={item.id}
                      onClick={() => execute(item)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${
                        active
                          ? "bg-brand-primary/20 text-brand-primary"
                          : "dark:hover:bg-neutral-card-dark hover:bg-neutral-light"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {!!Icon && <Icon className="h-4 w-4" />}
                        <div>
                          <div className="text-sm font-medium">{item.label}</div>
                          {item.subtitle && (
                            <div className="text-xs opacity-70">{item.subtitle}</div>
                          )}
                        </div>
                      </div>

                      {item.shortcut && (
                        <span className="font-mono text-[11px] opacity-70">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Right preview */}
              <div className="bg-neutral-light/70 dark:bg-neutral-card-dark/70 rounded-lg border border-neutral-border p-3 text-xs">
                {activeItem ? (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      {!!activeItem?.icon && <activeItem.icon className="h-4 w-4" />}
                      <span className="text-sm font-medium">{activeItem.label}</span>

                      <span className="ml-auto rounded border border-neutral-border px-2 py-0.5 text-[10px] uppercase opacity-70">
                        {activeItem.group}
                      </span>
                    </div>

                    <p className="text-neutral-text-secondary mb-2">
                      {activeItem.subtitle ||
                        "Run this command to navigate or perform an action inside Skillify."}
                    </p>

                    {activeItem.tags && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {activeItem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-neutral-card-light/80 dark:bg-neutral-card-dark rounded-full px-2 py-0.5 text-[10px] uppercase opacity-75"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex justify-between border-t border-neutral-border pt-2 text-[10px] opacity-70">
                      <span>Enter to run • Esc to close • ↑↓ to navigate</span>
                      <span>⌘K to toggle</span>
                    </div>
                  </>
                ) : (
                  <div className="text-neutral-text-secondary">
                    Start typing to search workspaces, pages, or actions.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

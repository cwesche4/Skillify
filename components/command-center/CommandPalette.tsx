// components/command/CommandPalette.tsx
"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Activity, Command, HelpCircle, Keyboard, Search, Users, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"

type WorkspaceSummary = {
  id: string
  name: string
  slug: string
}

type CommandKind = "automation" | "workspace" | "member" | "action" | "help"

interface CommandItem {
  id: string
  kind: CommandKind
  title: string
  subtitle?: string
  badge?: string
  route?: string
}

interface CommandSection {
  id: string
  label: string
  items: CommandItem[]
}

interface CommandSearchResponse {
  automations: { id: string; name: string; status: string }[]
  workspaces: { id: string; name: string; slug: string }[]
  members: {
    id: string
    role: string
    user: { id: string; clerkId: string }
  }[]
  actions: { id: string; label: string; route: string }[]
  help: { id: string; title: string; tags: string[] }[]
}

interface CommandPaletteProps {
  workspaces: WorkspaceSummary[]
  current?: WorkspaceSummary | null
}

export default function CommandPalette({ workspaces, current }: CommandPaletteProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [sections, setSections] = useState<CommandSection[]>([])
  const [highlightIndex, setHighlightIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const flatItems: CommandItem[] = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections],
  )

  // ─────────────────────────────────────────────
  // Keyboard: open/close (⌘K / Ctrl+K)
  // ─────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k"
      const isPalette =
        (isK && (e.metaKey || e.ctrlKey)) ||
        (e.key === "p" && e.metaKey) ||
        (e.key === "/" && (e.metaKey || e.ctrlKey))

      if (isPalette) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }

      if (!open) return

      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open && inputRef.current) {
      // small delay lets animation mount first
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      setQuery("")
      setSections([])
      setHighlightIndex(0)
    }
  }, [open])

  // ─────────────────────────────────────────────
  // Search backend (debounced)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    if (!query.trim()) {
      // show “jump to” defaults when no query
      const defaultSections: CommandSection[] = [
        {
          id: "quick",
          label: "Quick actions",
          items: [
            {
              id: "qa-automations",
              kind: "action",
              title: "Go to Automations",
              subtitle: "View and manage automations",
              route: "/dashboard/automations",
              badge: "G",
            },
            {
              id: "qa-analytics",
              kind: "action",
              title: "Open Analytics",
              subtitle: "Workspace performance & cost",
              route: "/dashboard/analytics",
            },
            {
              id: "qa-settings",
              kind: "action",
              title: "Workspace Settings",
              subtitle: "Members, billing, AI Coach",
              route: "/dashboard/settings",
            },
          ],
        },
        {
          id: "workspaces",
          label: "Workspaces",
          items: workspaces.map((ws) => ({
            id: `ws-${ws.id}`,
            kind: "workspace",
            title: ws.name,
            subtitle: ws.slug,
            route: `/dashboard?workspace=${ws.slug}`,
            badge: current && current.id === ws.id ? "Current" : undefined,
          })),
        },
      ]

      setSections(defaultSections)
      setHighlightIndex(0)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/command/search", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            workspaceId: current?.id ?? null,
          }),
        })

        if (!res.ok) {
          setLoading(false)
          return
        }

        const data = (await res.json()) as CommandSearchResponse

        const nextSections: CommandSection[] = []

        if (data.automations.length > 0) {
          nextSections.push({
            id: "automations",
            label: "Automations",
            items: data.automations.map((a) => ({
              id: `auto-${a.id}`,
              kind: "automation",
              title: a.name,
              subtitle: `Status: ${a.status}`,
              route: `/dashboard/automations/${a.id}`,
            })),
          })
        }

        if (data.workspaces.length > 0) {
          nextSections.push({
            id: "workspaces",
            label: "Workspaces",
            items: data.workspaces.map((ws) => ({
              id: `ws-${ws.id}`,
              kind: "workspace",
              title: ws.name,
              subtitle: ws.slug,
              route: `/dashboard?workspace=${ws.slug}`,
              badge: current && current.id === ws.id ? "Current" : undefined,
            })),
          })
        }

        if (data.members.length > 0) {
          nextSections.push({
            id: "members",
            label: "Members",
            items: data.members.map((m) => ({
              id: `mem-${m.id}`,
              kind: "member",
              title: m.user.clerkId,
              subtitle: `Role: ${m.role}`,
            })),
          })
        }

        if (data.actions.length > 0) {
          nextSections.push({
            id: "actions",
            label: "Actions",
            items: data.actions.map((a) => ({
              id: `action-${a.id}`,
              kind: "action",
              title: a.label,
              route: a.route,
            })),
          })
        }

        if (data.help.length > 0) {
          nextSections.push({
            id: "help",
            label: "Help",
            items: data.help.map((h) => ({
              id: `help-${h.id}`,
              kind: "help",
              title: h.title,
              subtitle: h.tags.join(", "),
            })),
          })
        }

        setSections(nextSections)
        setHighlightIndex(0)
        setLoading(false)
      } catch (err) {
        if (controller.signal.aborted) return
        setLoading(false)
      }
    }, 150)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [query, open, current, workspaces])

  // ─────────────────────────────────────────────
  // Execute selection
  // ─────────────────────────────────────────────
  const runItem = useCallback(
    (item: CommandItem) => {
      if (item.route) {
        setOpen(false)
        router.push(item.route)
        return
      }

      // Future: more behaviors for member/help/etc
      setOpen(false)
    },
    [router],
  )

  // ─────────────────────────────────────────────
  // Keyboard navigation within palette
  // ─────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (flatItems.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightIndex((prev) =>
          prev + 1 >= flatItems.length ? flatItems.length - 1 : prev + 1,
        )
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightIndex((prev) => (prev - 1 < 0 ? 0 : prev - 1))
      }

      if (e.key === "Enter") {
        e.preventDefault()
        const item = flatItems[highlightIndex]
        if (item) runItem(item)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, flatItems, highlightIndex, runItem])

  // ─────────────────────────────────────────────
  // Icon per item kind
  // ─────────────────────────────────────────────
  function kindIcon(kind: CommandKind) {
    switch (kind) {
      case "automation":
        return <Zap className="h-4 w-4 text-emerald-400" />
      case "workspace":
        return <Activity className="h-4 w-4 text-sky-400" />
      case "member":
        return <Users className="h-4 w-4 text-indigo-300" />
      case "action":
        return <Command className="h-4 w-4 text-amber-300" />
      case "help":
      default:
        return <HelpCircle className="h-4 w-4 text-slate-300" />
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <Fragment>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Palette container */}
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-24"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="bg-neutral-card-dark w-full max-w-xl rounded-2xl border border-neutral-border shadow-2xl">
              {/* Header / Input */}
              <div className="border-b border-neutral-border px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Search className="h-4 w-4" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search automations, workspaces, actions, help…"
                    className="text-neutral-text-primary flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-1 rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    <Keyboard className="h-3 w-3" />
                    <span>⌘K</span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="max-h-[360px] overflow-y-auto py-1.5">
                {loading && (
                  <div className="px-4 py-3 text-xs text-slate-400">Searching…</div>
                )}

                {!loading && flatItems.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">
                    No results. Try a different query.
                  </div>
                )}

                {!loading &&
                  sections.map((section) => (
                    <div key={section.id} className="px-1.5 py-1.5">
                      <div className="px-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {section.label}
                      </div>
                      <div className="mt-1 rounded-lg">
                        {section.items.map((item) => {
                          const index = flatItems.findIndex(
                            (x) => x.id === item.id && x.kind === item.kind,
                          )
                          const active = index === highlightIndex

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onMouseEnter={() =>
                                setHighlightIndex(index === -1 ? 0 : index)
                              }
                              onClick={() => runItem(item)}
                              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left ${
                                active
                                  ? "bg-brand-primary/20 text-neutral-text-primary"
                                  : "text-neutral-text-primary/90"
                              } `}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900">
                                  {kindIcon(item.kind)}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">
                                    {item.title}
                                  </span>
                                  {item.subtitle && (
                                    <span className="text-[11px] text-slate-400">
                                      {item.subtitle}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {item.badge && (
                                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                                    {item.badge}
                                  </span>
                                )}
                                {item.kind === "automation" && (
                                  <span className="text-[10px] text-slate-500">FLOW</span>
                                )}
                                {item.kind === "workspace" && (
                                  <span className="text-[10px] text-slate-500">ORG</span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  )
}

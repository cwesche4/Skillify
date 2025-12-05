// components/command-center/CommandCenterPalette.tsx
"use client"

import { Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { useCommandCenter } from "@/components/command-center/CommandCenterProvider"
import type { CommandItem } from "@/components/command-center/types"

type CommandSearchResponse = {
  items: CommandItem[]
}

interface PaletteProps {
  workspaces: { id: string; name: string; slug: string }[]
  current: { id: string; name: string; slug: string } | null
}

export default function CommandCenterPalette({ workspaces, current }: PaletteProps) {
  const router = useRouter()
  const { open, setOpen, query, setQuery, commands, setCommands } = useCommandCenter()

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function fetchCommands() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/command/search?q=${encodeURIComponent(query || "")}`,
        )
        if (!res.ok) return
        const json: CommandSearchResponse = await res.json()
        if (!cancelled) {
          setCommands(json.items ?? [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timeout = setTimeout(fetchCommands, 120)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [open, query, setCommands])

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>()
    for (const item of commands) {
      const key = item.group ?? "General"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    return Array.from(groups.entries())
  }, [commands])

  function close() {
    setOpen(false)
    setQuery("")
  }

  async function handleSelect(item: CommandItem) {
    if (item.href) {
      close()
      router.push(item.href)
      return
    }

    if (item.type === "command" || item.type === "onboarding") {
      const payload = item.meta ?? {}
      await fetch("/api/command/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      close()
      return
    }

    close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm">
      <div className="mt-16 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <Search size={16} className="text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces, automations, pages, commands, help..."
            className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto px-2 py-3 text-sm">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>
          )}

          {!loading && grouped.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">
              No results. Try another phrase.
            </div>
          )}

          {!loading &&
            grouped.map(([groupLabel, items]) => (
              <div key={groupLabel} className="mb-3">
                <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-slate-500">
                  {groupLabel}
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-slate-100 hover:bg-slate-900/80"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{item.label}</span>
                        {item.subtitle && (
                          <span className="text-[11px] text-slate-500">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {item.shortcut && (
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2">
          <div className="text-[10px] text-slate-500">
            Current workspace:{" "}
            <span className="text-slate-300">{current?.name ?? "Not selected"}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>
              <kbd className="rounded border border-slate-700 px-1 text-[9px]">⌘K</kbd> to
              open
            </span>
            <span>
              <kbd className="rounded border border-slate-700 px-1 text-[9px]">Esc</kbd>{" "}
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

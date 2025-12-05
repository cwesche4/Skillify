"use client"

import { motion } from "framer-motion"

import type { CommandSearchResult } from "@/lib/command-center/types"

import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { LayoutDashboard, LineChart, User, Workflow } from "lucide-react"

interface CommandCenterResultsProps {
  results: CommandSearchResult[]
  activeIndex: number
  onSelect: (result: CommandSearchResult) => void
}

/* ----------------------------------------------
   Icons by type
---------------------------------------------- */
const ICONS: Record<CommandSearchResult["type"], JSX.Element> = {
  workspace: <LayoutDashboard className="h-3.5 w-3.5" />,
  automation: <Workflow className="h-3.5 w-3.5" />,
  run: <LineChart className="h-3.5 w-3.5" />,
  member: <User className="h-3.5 w-3.5" />,
}

/* ----------------------------------------------
   Unified Result Renderer
---------------------------------------------- */
export default function CommandCenterResults({
  results,
  activeIndex,
  onSelect,
}: CommandCenterResultsProps) {
  if (!results.length) {
    return (
      <div className="px-4 py-10 text-center text-xs text-slate-500">
        No results. Try another search term.
      </div>
    )
  }

  return (
    <ul className="max-h-96 overflow-y-auto py-2">
      {results.map((result, index) => {
        const active = index === activeIndex

        return (
          <motion.li
            key={`${result.type}-${result.id}`}
            layout
            transition={{ duration: 0.15 }}
          >
            <button
              type="button"
              onClick={() => onSelect(result)}
              className={cn(
                "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-200 hover:bg-slate-900/60",
              )}
            >
              <div className="flex items-center gap-3">
                {/* TYPE ICON */}
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/70">
                  {ICONS[result.type]}
                </div>

                {/* TEXT */}
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{getPrimaryLabel(result)}</span>

                  <span className="text-[11px] text-slate-400">
                    {getSecondaryLabel(result)}
                  </span>
                </div>
              </div>

              {/* STATUS BADGE */}
              {getBadge(result)}
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}

/* ----------------------------------------------
   Helpers
---------------------------------------------- */
function getPrimaryLabel(r: CommandSearchResult) {
  switch (r.type) {
    case "workspace":
      return r.name
    case "automation":
      return r.name
    case "run":
      return r.automationName
    case "member":
      return r.clerkId
  }
}

function getSecondaryLabel(r: CommandSearchResult) {
  switch (r.type) {
    case "workspace":
      return `Workspace · ${r.slug}`

    case "automation":
      return `Automation · ${r.workspaceName}`

    case "run":
      return `Run · ${new Date(r.createdAt).toLocaleString()}`

    case "member":
      return `Member · ${r.workspaceName} · Role: ${r.role}`
  }
}

function getBadge(r: CommandSearchResult) {
  switch (r.type) {
    case "workspace":
      return <Badge variant="blue">Workspace</Badge>

    case "automation":
      return (
        <Badge
          variant={
            r.status === "ACTIVE" ? "green" : r.status === "PAUSED" ? "blue" : "default"
          }
        >
          {r.status}
        </Badge>
      )

    case "run":
      return (
        <Badge
          variant={
            r.status === "SUCCESS" ? "green" : r.status === "FAILED" ? "red" : "blue"
          }
        >
          {r.status}
        </Badge>
      )

    case "member":
      return <Badge variant="default">Member</Badge>
  }
}

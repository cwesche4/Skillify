"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"
import CreateWorkspaceModal from "./CreateWorkspaceModal"

export default function WorkspaceSwitcher({
  workspaces,
  current,
}: {
  workspaces: { id: string; name: string; slug: string }[]
  current: { id: string; name: string; slug: string } | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="bg-neutral-card-light text-neutral-text-primary dark:bg-neutral-card-dark flex items-center gap-2 rounded-lg border border-neutral-border px-3 py-2 text-sm font-medium hover:bg-neutral-light dark:text-white dark:hover:bg-neutral-dark"
      >
        {current ? current.name : "Select workspace"}
        <ChevronDown size={16} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-64 rounded-lg border border-neutral-border bg-white shadow-xl dark:bg-neutral-dark">
          <div className="max-h-64 overflow-y-auto py-2">
            {workspaces.map((ws) => (
              <a
                key={ws.id}
                href={`/dashboard?workspace=${ws.slug}`}
                className="text-neutral-text-primary dark:hover:bg-neutral-card-dark block px-3 py-2 text-sm hover:bg-neutral-light dark:text-white"
                onClick={() => setOpen(false)}
              >
                {ws.name}
              </a>
            ))}
          </div>

          <div className="border-t border-neutral-border p-3">
            <CreateWorkspaceModal onCreated={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

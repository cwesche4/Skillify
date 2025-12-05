"use client"

import { Bell } from "lucide-react"
import { useState } from "react"

const mockNotifications = [
  { id: 1, title: "New automation run", body: "Invoice Sync finished successfully." },
  { id: 2, title: "Usage alert", body: "You’re at 80% of your monthly runs." },
  { id: 3, title: "New feature", body: "Multi-workspace routing is now live." },
]

export function Notifications() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} className="text-slate-100" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-500" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
          <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">
            Notifications
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto px-3 py-2 text-xs">
            {mockNotifications.map((n) => (
              <div
                key={n.id}
                className="rounded-md bg-slate-800/60 p-2 hover:bg-slate-800"
              >
                <div className="font-medium text-slate-100">{n.title}</div>
                <div className="text-[11px] text-slate-400">{n.body}</div>
              </div>
            ))}
          </div>
          <button className="w-full border-t border-slate-800 px-3 py-1.5 text-center text-[11px] text-slate-400 hover:bg-slate-800/60">
            View all activity
          </button>
        </div>
      )}
    </div>
  )
}

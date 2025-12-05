// components/help/HelpPanel.tsx
"use client"

import { useEffect, useState } from "react"

export default function HelpPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler() {
      setOpen(true)
    }
    window.addEventListener("skillify-open-help", handler)
    return () => window.removeEventListener("skillify-open-help", handler)
  }, [])

  if (!open) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-100 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">Need help?</p>
          <p className="mt-1 text-slate-400">
            Use the Command Center (⌘K) to search docs, or visit the Help page for full
            guides and tutorials.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-[10px] text-slate-500 hover:text-slate-300"
        >
          Close
        </button>
      </div>
    </div>
  )
}

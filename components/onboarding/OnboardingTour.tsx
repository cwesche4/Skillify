// components/onboarding/OnboardingTour.tsx
"use client"

import { useEffect, useState } from "react"

export default function OnboardingTour() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("skillify-open-tour", handler)
    return () => window.removeEventListener("skillify-open-tour", handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="bg-neutral-card-dark w-full max-w-md rounded-2xl border border-neutral-border p-5 shadow-2xl">
        <h3 className="text-neutral-text-primary mb-2 font-semibold">Skillify Tour</h3>

        <p className="text-neutral-text-secondary mb-4 text-xs leading-relaxed">
          This is a placeholder for the interactive tour. We will later highlight:
          <br />• Sidebar
          <br />• Command Center
          <br />• Automations
          <br />• Analytics
          <br />• Workspaces
        </p>

        <button
          onClick={() => setOpen(false)}
          className="text-neutral-text-primary rounded-lg border border-neutral-border px-3 py-1 text-xs hover:bg-neutral-dark"
        >
          Close tour
        </button>
      </div>
    </div>
  )
}

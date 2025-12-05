// app/dashboard/automations/page.tsx
"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { FirstAutomationTour } from "@/components/onboarding/FirstAutomationTour"
import { Button } from "@/components/ui/Button"
import { useEffect, useState } from "react"

type AutomationListItem = {
  id: string
  name: string
  status: string
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationListItem[]>([])
  const [name, setName] = useState("")

  useEffect(() => {
    fetch("/api/automations")
      .then((res) => res.json())
      .then((data) => setAutomations(data.data || []))
      .catch(() => setAutomations([]))
  }, [])

  const create = async () => {
    if (!name) {
      alert("Enter a name")
      return
    }

    // Placeholder for now – we’ll wire workspaceId later via context/URL.
    alert("Wire workspaceId automatically later via Workspace context.")
  }

  return (
    <DashboardShell>
      {/* Onboarding tour banner */}
      <section className="mb-6">
        <FirstAutomationTour />
      </section>

      <h1 className="h2 mb-4">Automations</h1>

      {/* Create automation card */}
      <div className="card mb-6 max-w-xl space-y-3">
        <h2 className="h3">Create Automation</h2>

        <input
          className="form-input"
          placeholder="Automation name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Button onClick={create}>Create</Button>
      </div>

      {/* Automations grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {automations.length === 0 ? (
          <div className="text-neutral-text-secondary text-sm">
            No automations yet. Start by creating your first flow above.
          </div>
        ) : (
          automations.map((a) => (
            <a
              key={a.id}
              href={`/dashboard/automations/${a.id}`}
              className="card-hover card"
            >
              <h3 className="h4">{a.name}</h3>
              <p className="body text-neutral-text-secondary">Status: {a.status}</p>
            </a>
          ))
        )}
      </div>
    </DashboardShell>
  )
}

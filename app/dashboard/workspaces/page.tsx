// app/dashboard/workspaces/page.tsx
"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { SIDEBAR_ITEMS } from "@/components/dashboard/sidebar-items"
import { Button } from "@/components/ui/Button"
import { useEffect, useState } from "react"

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/workspaces")
      .then((res) => res.json())
      .then((data) => setWorkspaces(data.data))
  }, [])

  return (
    <DashboardShell sidebarItems={SIDEBAR_ITEMS}>
      <h1 className="h2 mb-4">Your Workspaces</h1>

      <Button
        onClick={() => {
          const name = prompt("Workspace name")
          fetch("/api/workspaces", {
            method: "POST",
            body: JSON.stringify({ name }),
          }).then(() => window.location.reload())
        }}
      >
        + Create Workspace
      </Button>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {workspaces.map((ws) => (
          <a
            key={ws.id}
            href={`/dashboard/workspaces/${ws.id}`}
            className="card hover-lift"
          >
            <h2 className="h3">{ws.name}</h2>
            <p className="body">{ws.slug}</p>
          </a>
        ))}
      </div>
    </DashboardShell>
  )
}

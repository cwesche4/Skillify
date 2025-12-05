// app/dashboard/workspaces/[id]/settings/page.tsx
"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { SIDEBAR_ITEMS } from "@/components/dashboard/sidebar-items"
import { Button } from "@/components/ui/Button"
import { useState } from "react"

export default function WorkspaceSettingsPage({ params }: { params: { id: string } }) {
  const [name, setName] = useState("")

  const save = () => {
    fetch(`/api/workspaces/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    })
  }

  const remove = async () => {
    await fetch(`/api/workspaces/${params.id}`, {
      method: "DELETE",
    })
    window.location.href = "/dashboard/workspaces"
  }

  return (
    <DashboardShell sidebarItems={SIDEBAR_ITEMS}>
      <h1 className="h2 mb-6">Workspace Settings</h1>

      <input
        className="form-input mb-4"
        placeholder="Workspace name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Button onClick={save}>Save</Button>

      <Button className="btn-danger mt-6" onClick={remove}>
        Delete Workspace
      </Button>
    </DashboardShell>
  )
}

// app/dashboard/workspaces/[id]/members/page.tsx
"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { SIDEBAR_ITEMS } from "@/components/dashboard/sidebar-items"
import { Button } from "@/components/ui/Button"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

type Member = {
  id: string
  role: string
  user: { id: string; clerkId: string }
}

type Invite = {
  id: string
  email: string
  role: string
  acceptedAt: string | null
  createdAt: string
}

export default function WorkspaceMembersPage() {
  const params = useParams()
  const workspaceId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/workspaces/${workspaceId}/members`)
    const data = await res.json()
    setMembers(data.members || [])
    setInvites(data.invites || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [workspaceId])

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove member?")) return
    await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: "DELETE",
    })
    load()
  }

  const resendInvite = async (inviteId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/invite/${inviteId}/resend`, {
      method: "POST",
    })
    alert("Invite resent!")
  }

  return (
    <DashboardShell sidebarItems={SIDEBAR_ITEMS}>
      <h1 className="h2 mb-4">Workspace Members</h1>

      {/* ACTIVE MEMBERS */}
      <div className="card space-y-4">
        <h2 className="h3">Active Members</h2>

        {members.length === 0 ? (
          <p className="body text-neutral-text-secondary">No members yet.</p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b border-slate-800 py-3 last:border-none"
            >
              <div>
                <div className="font-medium">User: {m.user.clerkId}</div>
                <div className="text-neutral-text-secondary text-sm">Role: {m.role}</div>
              </div>

              <Button
                variant="danger"
                size="sm"
                disabled={m.role === "OWNER"}
                onClick={() => removeMember(m.id)}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      {/* INVITES */}
      <div className="card space-y-4">
        <h2 className="h3">Pending Invites</h2>

        {invites.length === 0 ? (
          <p className="body text-neutral-text-secondary">No invites.</p>
        ) : (
          invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between border-b border-slate-800 py-3 last:border-none"
            >
              <div>
                <div className="font-medium">{inv.email}</div>
                <div className="text-neutral-text-secondary text-sm">
                  Role: {inv.role}
                </div>
              </div>

              <Button size="sm" onClick={() => resendInvite(inv.id)}>
                Resend
              </Button>
            </div>
          ))
        )}
      </div>
    </DashboardShell>
  )
}

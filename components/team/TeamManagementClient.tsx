// components/team/TeamManagementClient.tsx
'use client'

import { useMemo, useState } from 'react'
import type { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import {
  canManageWorkspaceMembers,
  getWorkspaceRoleLabel,
  inviteRoleOptions,
  workspaceRoleOptions,
} from '@/lib/workspaces/workspaceRoles'

type MemberRow = {
  id: string
  userId: string
  role: WorkspaceMemberRole
  fullName: string | null
  email: string | null
  createdAt: string
}

type InviteRow = {
  id: string
  email: string
  role: WorkspaceMemberRole
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

function canManage(myRole: WorkspaceMemberRole) {
  return canManageWorkspaceMembers(myRole)
}

export default function TeamManagementClient({
  workspaceId,
  workspaceSlug,
  myRole,
  initialMembers,
  initialInvites,
}: {
  workspaceId: string
  workspaceSlug: string
  myRole: WorkspaceMemberRole
  initialMembers: MemberRow[]
  initialInvites: InviteRow[]
}) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers)
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('MEMBER')
  const [busy, setBusy] = useState<string | null>(null)

  const managersEnabled = useMemo(() => canManage(myRole), [myRole])

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      cache: 'no-store',
    })
    const json = await res.json()
    if (res.ok) setMembers(json.members)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setBusy('invite')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to invite')

      // naive refresh invites by reloading current page data via hard reload
      // (You can add a GET invites route later; this is enough to ship now.)
      window.location.href = `/dashboard/${workspaceSlug}/members`
    } finally {
      setBusy(null)
    }
  }

  async function updateRole(memberId: string, role: WorkspaceMemberRole) {
    setBusy(`role:${memberId}`)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to update role')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  async function removeMember(memberId: string) {
    setBusy(`remove:${memberId}`)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members?memberId=${memberId}`,
        {
          method: 'DELETE',
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to remove member')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          Team
        </h1>
        <p className="text-neutral-text-secondary text-sm">
          Manage members, roles, and invitations for this workspace.
        </p>
      </section>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-neutral-text-primary text-sm font-semibold">
              Invite a member
            </div>
            <div className="text-neutral-text-secondary text-xs">
              Owners/Admins can invite members by email.
            </div>
          </div>

          <div className="grid w-full gap-2 md:max-w-2xl md:grid-cols-[1fr_160px_140px]">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={!managersEnabled || busy === 'invite'}
            />
            <Select
              value={inviteRole}
              onValueChange={(v: string) =>
                setInviteRole(v as WorkspaceMemberRole)
              }
              disabled={!managersEnabled || busy === 'invite'}
            >
              {inviteRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
            <Button
              onClick={sendInvite}
              disabled={!managersEnabled || busy === 'invite'}
            >
              Send invite
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-neutral-text-primary text-sm font-semibold">
            Members
          </div>
          <Badge>{members.length}</Badge>
        </div>

        <div className="divide-y divide-neutral-border">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="text-neutral-text-primary text-sm font-medium">
                  {m.fullName ?? 'Unnamed user'}
                </div>
                <div className="text-neutral-text-secondary text-xs">
                  {m.email ?? 'No email on profile'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={m.role}
                  onValueChange={(v: string) =>
                    updateRole(m.id, v as WorkspaceMemberRole)
                  }
                  disabled={!managersEnabled || busy === `role:${m.id}`}
                >
                  {workspaceRoleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="danger"
                  onClick={() => removeMember(m.id)}
                  disabled={!managersEnabled || busy === `remove:${m.id}`}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-neutral-text-primary text-sm font-semibold">
            Invites
          </div>
          <Badge>{invites.length}</Badge>
        </div>

        <div className="space-y-2">
          {invites.map((i) => (
            <div
              key={i.id}
              className="rounded-xl border border-neutral-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-neutral-text-primary text-sm font-medium">
                    {i.email}
                  </div>
                  <div className="text-neutral-text-secondary text-xs">
                    Role: {getWorkspaceRoleLabel(i.role)} · Expires:{' '}
                    {new Date(i.expiresAt).toLocaleString()}
                    {i.acceptedAt
                      ? ` · Accepted: ${new Date(i.acceptedAt).toLocaleString()}`
                      : ''}
                  </div>
                </div>
                <div className="text-neutral-text-secondary text-xs">
                  {/* Token shown for now (until you add email sending) */}
                  Token: <code className="text-[11px]">{i.token}</code>
                </div>
              </div>
            </div>
          ))}
          {!invites.length && (
            <div className="text-neutral-text-secondary text-sm">
              No pending invites.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import type { WorkspaceMemberRole } from '@/lib/prisma/enums'
import {
  getWorkspaceRoleLabel,
  inviteRoleOptions,
} from '@/lib/workspaces/workspaceRoles'
import type { WorkspaceInvite } from './useWorkspaceTeam'

export function InvitesPanel({
  workspaceId,
  canManage,
  invites,
  onChanged,
}: {
  workspaceId: string
  canManage: boolean
  invites: WorkspaceInvite[]
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceMemberRole>('MEMBER' as any)
  const [busy, setBusy] = useState(false)

  const pending = useMemo(() => invites.filter((i) => !i.acceptedAt), [invites])

  async function createInvite() {
    setBusy(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEmail('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/invite?inviteId=${encodeURIComponent(inviteId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(await res.text())
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function resendInvite(email: string, role: WorkspaceMemberRole) {
    setBusy(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) throw new Error(await res.text())
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  function copyAcceptLink(token: string) {
    const url = `${window.location.origin}/onboarding/accept-invite?token=${token}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="dark:bg-neutral-card-dark rounded-2xl border border-neutral-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-neutral-text-primary text-sm font-semibold">
          Invites
        </h2>
        <p className="text-neutral-text-secondary text-xs">
          {pending.length} pending
        </p>
      </div>

      {canManage && (
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_140px]">
          <input
            className="rounded-xl border border-neutral-border bg-transparent px-3 py-2 text-sm"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="rounded-xl border border-neutral-border bg-transparent px-3 py-2 text-sm"
            value={role as any}
            onChange={(e) => setRole(e.target.value as any)}
          >
            {inviteRoleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={busy || !email.trim()}
            onClick={createInvite}
          >
            Send invite
          </button>
        </div>
      )}

      <div className="space-y-2">
        {pending.map((i) => (
          <div
            key={i.id}
            className="flex flex-col gap-2 rounded-xl border border-neutral-border p-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="text-neutral-text-primary text-sm font-medium">
                {i.email}
              </div>
              <div className="text-neutral-text-secondary text-xs">
                Role: {getWorkspaceRoleLabel(i.role)} • Expires:{' '}
                {new Date(i.expiresAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-neutral-border px-3 py-1 text-xs"
                onClick={() => copyAcceptLink(i.token)}
              >
                Copy link
              </button>
              {canManage && (
                <>
                  <button
                    className="rounded-lg border border-neutral-border px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => resendInvite(i.email, i.role)}
                  >
                    Resend
                  </button>
                  <button
                    className="rounded-lg border border-neutral-border px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => revokeInvite(i.id)}
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {pending.length === 0 && (
          <div className="text-neutral-text-secondary rounded-xl border border-neutral-border p-4 text-sm">
            No pending invites.
          </div>
        )}
      </div>
    </div>
  )
}

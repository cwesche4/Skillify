'use client'

import React from 'react'
import { useState } from 'react'

import type { Role } from '@/app/dashboard/[workspaceSlug]/members/MemberList'
import {
  getWorkspaceRoleLabel,
  inviteRoleOptions,
} from '@/lib/workspaces/workspaceRoles'

export type PendingInviteRow = {
  id: string
  email: string
  role: Role
  status?: string
  expiresAt: string
  createdAt: string
}

export function PendingInvitationsList({
  workspaceId,
  invites,
  currentRole = 'MEMBER',
  onChanged,
}: {
  workspaceId: string
  invites: PendingInviteRow[]
  currentRole?: Role
  onChanged?: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN'

  function refreshAfterChange() {
    setBusyId(null)
    if (onChanged) {
      onChanged()
      return
    }
    location.reload()
  }

  async function resend(invite: PendingInviteRow) {
    setBusyId(invite.id)
    setError(null)
    const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invite.email, role: invite.role }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? 'Could not resend invitation.')
      setBusyId(null)
      return
    }
    refreshAfterChange()
  }

  async function changeRole(inviteId: string, role: Role) {
    setBusyId(inviteId)
    setError(null)
    const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId, role }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? 'Could not update invitation role.')
      setBusyId(null)
      return
    }
    refreshAfterChange()
  }

  async function cancel(inviteId: string) {
    setBusyId(inviteId)
    setError(null)
    const response = await fetch(
      `/api/workspaces/${workspaceId}/invites?inviteId=${encodeURIComponent(
        inviteId,
      )}`,
      { method: 'DELETE' },
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? 'Could not cancel invitation.')
      setBusyId(null)
      return
    }
    refreshAfterChange()
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/45">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Pending Invitations
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            People invited to join this workspace who do not have access yet.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200">
          {invites.length} pending
        </span>
      </div>

      {error ? (
        <div className="border-b border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {invites.length ? (
        <div className="divide-y divide-slate-800">
          {invites.map((invite) => {
            const disabled = busyId === invite.id
            const status = invite.status === 'expired' ? 'Expired' : 'Pending'

            return (
              <div
                key={invite.id}
                className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-100">
                    {invite.email}
                  </div>
                  <div className="text-neutral-text-secondary text-xs">
                    Invited {new Date(invite.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-neutral-text-secondary text-xs">
                  Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-medium text-amber-100">
                    {status}
                  </span>
                  {canManage ? (
                    <select
                      value={invite.role}
                      disabled={disabled}
                      onChange={(event) =>
                        changeRole(invite.id, event.target.value as Role)
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-neutral-100 disabled:opacity-60"
                      aria-label={`Change invited role for ${invite.email}`}
                    >
                      {inviteRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-neutral-text-secondary text-xs">
                      {getWorkspaceRoleLabel(invite.role)}
                    </span>
                  )}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => resend(invite)}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => cancel(invite.id)}
                      className="rounded-lg border border-rose-400/30 px-2 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-neutral-text-secondary px-4 py-5 text-sm">
          No pending invitations.
        </div>
      )}
    </section>
  )
}

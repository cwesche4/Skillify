// app/dashboard/[workspaceSlug]/settings/members/MemberList.tsx
'use client'

import React from 'react'
import { useState } from 'react'
import type {
  MemberRow,
  Role,
} from '@/app/dashboard/[workspaceSlug]/members/MemberList'
import {
  getWorkspaceRoleLabel,
  workspaceRoleOptions,
} from '@/lib/workspaces/workspaceRoles'

export default function MemberList({
  workspaceId,
  members,
  currentRole = 'MEMBER',
  workspaceSlug,
}: {
  workspaceId: string
  members: MemberRow[]
  currentRole?: Role
  workspaceSlug?: string
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN'

  async function updateRole(memberId: string, role: string) {
    setBusyId(memberId)
    const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role }),
    })
    if (!response.ok) {
      setBusyId(null)
      return
    }
    location.reload()
  }

  async function remove(memberId: string) {
    setBusyId(memberId)
    const response = await fetch(
      `/api/workspaces/${workspaceId}/members?memberId=${encodeURIComponent(
        memberId,
      )}`,
      {
        method: 'DELETE',
      },
    )
    if (!response.ok) {
      setBusyId(null)
      return
    }
    location.reload()
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/45">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Active Members
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            People who currently have access to this workspace.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200">
          {members.length} active
        </span>
      </div>

      {members.length ? (
        <div className="divide-y divide-slate-800">
          {members.map((m) => {
            const isOwner = m.role === 'OWNER'
            const controlsDisabled =
              busyId === m.id || (isOwner && currentRole !== 'OWNER')

            return (
              <div
                key={m.id}
                className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-100">
                    {m.fullName ?? 'Unnamed member'}
                  </div>
                  <div className="text-neutral-text-secondary truncate text-xs">
                    {m.email ?? 'No email on file'}
                  </div>
                </div>
                <div className="text-neutral-text-secondary text-xs">
                  Joined {new Date(m.createdAt).toLocaleDateString()}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {canManage ? (
                    <>
                      <select
                        value={m.role}
                        disabled={controlsDisabled}
                        onChange={(e) => updateRole(m.id, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-neutral-100 disabled:opacity-60"
                        aria-label={`Change role for ${m.fullName ?? m.email ?? 'member'}`}
                      >
                        {workspaceRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        disabled={controlsDisabled}
                        className="rounded-lg border border-rose-400/30 px-2 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          isOwner && currentRole !== 'OWNER'
                            ? 'Only an Owner can remove another Owner.'
                            : 'Remove member'
                        }
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200">
                      {getWorkspaceRoleLabel(m.role)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-neutral-text-secondary px-4 py-5 text-sm">
          No active members.
        </div>
      )}
    </section>
  )
}

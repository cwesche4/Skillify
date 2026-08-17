'use client'

import { useState } from 'react'
import type { WorkspaceMemberRole } from '@/lib/prisma/enums'
import {
  getWorkspaceRoleLabel,
  workspaceRoleOptions,
} from '@/lib/workspaces/workspaceRoles'
import type { TeamMember } from './useWorkspaceTeam'

export function MembersTable({
  workspaceId,
  canManage,
  members,
  onChanged,
}: {
  workspaceId: string
  canManage: boolean
  members: TeamMember[]
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function changeRole(memberId: string, role: WorkspaceMemberRole) {
    setBusyId(memberId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      if (!res.ok) throw new Error(await res.text())
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function removeMember(memberId: string) {
    setBusyId(memberId)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members?memberId=${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(await res.text())
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dark:bg-neutral-card-dark rounded-2xl border border-neutral-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-neutral-text-primary text-sm font-semibold">
          Members
        </h2>
        <p className="text-neutral-text-secondary text-xs">
          {members.length} total
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-text-secondary text-left text-xs">
            <tr className="border-b border-neutral-border">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Joined</th>
              <th className="py-2 pr-0 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-neutral-border/60 border-b">
                <td className="py-3 pr-3">
                  <div className="text-neutral-text-primary font-medium">
                    {m.fullName ?? 'Unnamed'}
                  </div>
                </td>
                <td className="text-neutral-text-secondary py-3 pr-3">
                  {m.email ?? '—'}
                </td>
                <td className="py-3 pr-3">
                  {canManage ? (
                    <select
                      className="rounded-lg border border-neutral-border bg-transparent px-2 py-1 text-sm"
                      value={m.role as any}
                      disabled={busyId === m.id}
                      onChange={(e) =>
                        changeRole(m.id, e.target.value as WorkspaceMemberRole)
                      }
                    >
                      {workspaceRoleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full border border-neutral-border px-2 py-1 text-xs">
                      {getWorkspaceRoleLabel(m.role)}
                    </span>
                  )}
                </td>
                <td className="text-neutral-text-secondary py-3 pr-3">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 pr-0 text-right">
                  {canManage ? (
                    <button
                      className="rounded-lg border border-neutral-border px-3 py-1 text-xs"
                      disabled={busyId === m.id}
                      onClick={() => removeMember(m.id)}
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-neutral-text-secondary text-xs">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

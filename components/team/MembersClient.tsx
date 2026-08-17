'use client'

import { useEffect, useMemo, useState } from 'react'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import {
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
  createdAt: string
}

async function jsonFetch<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init)
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data as T
}

export default function MembersClient({
  workspaceId,
}: {
  workspaceId: string
  workspaceSlug: string
}) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>(
    WorkspaceMemberRole.MEMBER,
  )
  const [busy, setBusy] = useState(false)

  const loadAll = async () => {
    setErr(null)
    setLoading(true)
    try {
      const m = await jsonFetch<{ members: MemberRow[] }>(
        `/api/workspaces/${workspaceId}/members`,
        {
          cache: 'no-store',
        },
      )
      const i = await jsonFetch<{ invites: InviteRow[] }>(
        `/api/workspaces/${workspaceId}/invites`,
        {
          cache: 'no-store',
        },
      )
      setMembers(m.members)
      setInvites(i.invites)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const roleOptions = useMemo(() => workspaceRoleOptions, [])

  const invite = async () => {
    setBusy(true)
    setErr(null)
    try {
      await jsonFetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      setInviteEmail('')
      setInviteRole(WorkspaceMemberRole.MEMBER)
      await loadAll()
    } catch (e: any) {
      setErr(e?.message || 'Invite failed')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (memberId: string, role: WorkspaceMemberRole) => {
    setBusy(true)
    setErr(null)
    try {
      await jsonFetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      await loadAll()
    } catch (e: any) {
      setErr(e?.message || 'Role update failed')
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setBusy(true)
    setErr(null)
    try {
      await jsonFetch(
        `/api/workspaces/${workspaceId}/members?memberId=${memberId}`,
        {
          method: 'DELETE',
        },
      )
      await loadAll()
    } catch (e: any) {
      setErr(e?.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  const revokeInvite = async (inviteId: string) => {
    setBusy(true)
    setErr(null)
    try {
      await jsonFetch(
        `/api/workspaces/${workspaceId}/invites?inviteId=${inviteId}`,
        {
          method: 'DELETE',
        },
      )
      await loadAll()
    } catch (e: any) {
      setErr(e?.message || 'Revoke failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="text-neutral-text-secondary text-sm">Loading team…</div>
    )
  }

  return (
    <div className="space-y-8">
      {err ? (
        <div className="bg-neutral-card-light dark:bg-neutral-card-dark rounded-lg border border-neutral-border p-3 text-sm text-red-600">
          {err}
        </div>
      ) : null}

      <div className="bg-neutral-card-light dark:bg-neutral-card-dark rounded-2xl border border-neutral-border p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Invite member</h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-neutral-text-secondary mb-1 block text-xs">
              Email
            </label>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-border bg-transparent px-3 py-2 text-sm"
              placeholder="name@company.com"
            />
          </div>

          <div className="w-full sm:w-56">
            <label className="text-neutral-text-secondary mb-1 block text-xs">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as WorkspaceMemberRole)
              }
              className="w-full rounded-lg border border-neutral-border bg-transparent px-3 py-2 text-sm"
            >
              {inviteRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <button
            disabled={busy || !inviteEmail.trim()}
            onClick={invite}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Send invite
          </button>
        </div>
      </div>

      <div className="bg-neutral-card-light dark:bg-neutral-card-dark rounded-2xl border border-neutral-border p-5">
        <h2 className="mb-3 text-base font-semibold">Members</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-text-secondary text-xs">
              <tr>
                <th className="py-2">User</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-neutral-border">
                  <td className="py-3">{m.fullName ?? '—'}</td>
                  <td className="py-3">{m.email ?? '—'}</td>
                  <td className="py-3">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        changeRole(m.id, e.target.value as WorkspaceMemberRole)
                      }
                      className="rounded-lg border border-neutral-border bg-transparent px-2 py-1 text-sm"
                      disabled={busy}
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      disabled={busy}
                      onClick={() => removeMember(m.id)}
                      className="rounded-lg border border-neutral-border px-3 py-1 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td
                    className="text-neutral-text-secondary py-4 text-sm"
                    colSpan={4}
                  >
                    No members found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-neutral-card-light dark:bg-neutral-card-dark rounded-2xl border border-neutral-border p-5">
        <h2 className="mb-3 text-base font-semibold">Pending invites</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-text-secondary text-xs">
              <tr>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Invite token</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-t border-neutral-border">
                  <td className="py-3">{i.email}</td>
                  <td className="py-3">{i.role}</td>
                  <td className="py-3 font-mono text-xs">{i.token}</td>
                  <td className="py-3 text-right">
                    <button
                      disabled={busy}
                      onClick={() => revokeInvite(i.id)}
                      className="rounded-lg border border-neutral-border px-3 py-1 text-xs"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {invites.length === 0 ? (
                <tr>
                  <td
                    className="text-neutral-text-secondary py-4 text-sm"
                    colSpan={4}
                  >
                    No pending invites.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-neutral-text-secondary mt-3 text-xs">
          For now, tokens are shown because email sending isn’t wired yet. Later
          we’ll send invites via Resend/Postmark.
        </p>
      </div>
    </div>
  )
}

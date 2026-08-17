// app/dashboard/[workspaceSlug]/members/MemberList.tsx
'use client'

import { useMemo, useState } from 'react'

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
export type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

export type MemberRow = {
  id: string
  role: Role
  userId: string
  fullName?: string | null
  email?: string | null
  createdAt: string
}

const PLAN_RANK: Record<Plan, number> = {
  Free: 0,
  Basic: 1,
  Pro: 2,
  Elite: 3,
}

function requirePlan(required: Plan, actual: Plan) {
  return PLAN_RANK[actual] >= PLAN_RANK[required]
}

function isManager(role: Role) {
  return role === 'OWNER' || role === 'ADMIN'
}

function RolePill({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {role}
    </span>
  )
}

export default function MemberList({
  workspaceId,
  currentRole,
  plan = 'Free',
  members,
  loading,
  onChanged,
}: {
  workspaceId: string
  currentRole: Role
  plan?: Plan
  members: MemberRow[]
  loading?: boolean
  onChanged?: () => void
}) {
  const canManageRole = useMemo(() => isManager(currentRole), [currentRole])
  const canManageOwners = useMemo(() => currentRole === 'OWNER', [currentRole])

  // B) Billing enforcement: member management is Pro+
  const canUseMemberMgmtByPlan = useMemo(() => requirePlan('Pro', plan), [plan])

  const canUseAuditLogs = useMemo(() => plan === 'Elite', [plan])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function changeRole(memberId: string, role: Role) {
    try {
      setErr(null)
      setBusyId(memberId)
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update role')
      onChanged?.()
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update role')
    } finally {
      setBusyId(null)
    }
  }

  async function removeMember(memberId: string) {
    try {
      setErr(null)
      setBusyId(memberId)
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members?memberId=${encodeURIComponent(
          memberId,
        )}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to remove member')
      onChanged?.()
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to remove member')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="rounded-lg border p-4 text-sm">Loading members…</div>
  }

  if (!canUseMemberMgmtByPlan) {
    return (
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Members</div>
            <div className="text-muted-foreground mt-1 text-sm">
              Member management is a <span className="font-medium">Pro</span>{' '}
              feature.
            </div>
          </div>
          <div className="text-muted-foreground text-xs">
            Current plan: <span className="font-medium">{plan}</span>
          </div>
        </div>

        <div className="mt-3">
          <a
            href={`/dashboard/${window.location.pathname.split('/')[2]}/upsell`}
            className="hover:bg-muted inline-flex rounded-md border px-3 py-2 text-sm font-medium"
          >
            Upgrade to Pro
          </a>
        </div>

        <div className="text-muted-foreground mt-4 text-xs">
          {members.length} member(s) currently in this workspace.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <div className="text-sm font-medium">Members</div>
          <div className="text-muted-foreground text-xs">
            {members.length} total
          </div>
          {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-muted-foreground text-xs">
            Plan: <span className="font-medium">{plan}</span>
          </div>
          {canUseAuditLogs ? (
            <a
              className="hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium"
              href={`/dashboard/${window.location.pathname.split('/')[2]}/settings/audit`}
              title="Elite feature"
            >
              Audit Logs
            </a>
          ) : null}
        </div>
      </div>

      <div className="divide-y">
        {members.map((m) => {
          const isOwner = m.role === 'OWNER'
          const uiManageDisabled =
            !canManageRole || (isOwner && !canManageOwners) || busyId === m.id

          return (
            <div
              key={m.id}
              className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {m.fullName ?? 'Unnamed'}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {m.email ?? '—'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <RolePill role={m.role} />

                {canManageRole ? (
                  <>
                    <select
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                      value={m.role}
                      disabled={uiManageDisabled}
                      onChange={(e) => changeRole(m.id, e.target.value as Role)}
                      title={
                        isOwner && !canManageOwners
                          ? 'Only OWNER can change an OWNER'
                          : 'Change role'
                      }
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="OWNER">OWNER</option>
                    </select>

                    <button
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                      disabled={uiManageDisabled}
                      onClick={() => removeMember(m.id)}
                      title={
                        isOwner && !canManageOwners
                          ? 'Only OWNER can remove an OWNER'
                          : 'Remove member'
                      }
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    You don’t have permission to manage members.
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

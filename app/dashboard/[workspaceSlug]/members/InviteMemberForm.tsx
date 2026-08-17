// app/dashboard/[workspaceSlug]/members/InviteMemberForm.tsx
'use client'

import { useMemo, useState } from 'react'
import { inviteRoleOptions } from '@/lib/workspaces/workspaceRoles'

type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

const PLAN_RANK: Record<Plan, number> = {
  Free: 0,
  Basic: 1,
  Pro: 2,
  Elite: 3,
}

function requirePlan(required: Plan, actual: Plan) {
  return PLAN_RANK[actual] >= PLAN_RANK[required]
}

export default function InviteMemberForm({
  workspaceId,
  currentRole,
  plan,
  onSuccess,
}: {
  workspaceId: string
  currentRole: Role
  plan: Plan
  onSuccess?: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const canManage = useMemo(
    () => currentRole === 'OWNER' || currentRole === 'ADMIN',
    [currentRole],
  )

  // B) Billing enforcement: inviting is Pro+
  const canInviteByPlan = useMemo(() => requirePlan('Pro', plan), [plan])

  const disabled = !canManage || !canInviteByPlan || submitting

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setMsg('Email is required.')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create invite')

      const token = data?.invite?.token
      setMsg(
        token
          ? `Invite ${data.action}. Token: ${token}`
          : `Invite ${data.action}.`,
      )

      setEmail('')
      setRole('MEMBER')
      onSuccess?.()
    } catch (err: any) {
      setMsg(err?.message ?? 'Failed to create invite')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canInviteByPlan) {
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium">Invite Member</div>
        <div className="text-muted-foreground mt-1 text-sm">
          Inviting teammates is a <span className="font-medium">Pro</span>{' '}
          feature.
        </div>
        <div className="mt-3">
          <a
            href={`/dashboard/${window.location.pathname.split('/')[2]}/upsell`}
            className="hover:bg-muted inline-flex rounded-md border px-3 py-2 text-sm font-medium"
          >
            Upgrade to Pro
          </a>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Invite Member</div>
          <div className="text-muted-foreground mt-1 text-xs">
            Add teammates to this workspace. (Emails later; token shown for
            testing.)
          </div>
        </div>
        <div className="text-muted-foreground text-xs">
          Plan: <span className="font-medium">{plan}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            autoComplete="email"
            disabled={disabled}
          />
        </div>

        <div className="w-full md:w-52">
          <label className="text-sm font-medium">Role</label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={disabled}
          >
            {inviteRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
          disabled={disabled}
          title={!canManage ? 'Only OWNER/ADMIN can invite' : undefined}
        >
          {submitting ? 'Inviting…' : 'Invite'}
        </button>
      </div>

      {msg ? <p className="text-muted-foreground mt-3 text-sm">{msg}</p> : null}

      {!canManage ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Only <span className="font-medium">OWNER</span> or{' '}
          <span className="font-medium">ADMIN</span> can invite members.
        </p>
      ) : null}
    </form>
  )
}

// app/dashboard/[workspaceSlug]/settings/members/InviteMemberForm.tsx
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

export interface InviteMemberFormProps {
  workspaceId: string
  currentRole: Role
  plan: Plan
  onSuccess?: () => void
}

export default function InviteMemberForm({
  workspaceId,
  currentRole,
  plan,
  onSuccess,
}: InviteMemberFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('MEMBER')

  const canManage = useMemo(
    () => currentRole === 'OWNER' || currentRole === 'ADMIN',
    [currentRole],
  )
  const canInviteByPlan = useMemo(() => requirePlan('Pro', plan), [plan])
  const disabled = !canManage || !canInviteByPlan || loading

  async function submit() {
    if (!email.trim()) return

    setLoading(true)
    setMessage(null)

    const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setMessage(data.error || 'Failed to invite')
      return
    }

    setEmail('')
    setRole('MEMBER')
    setMessage(data.action === 'resent' ? 'Invite resent' : 'Invite sent')
    onSuccess?.()
  }

  if (!canInviteByPlan) {
    return (
      <div className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Invite Member</h2>
        <p className="text-muted-foreground text-sm">
          Inviting teammates is a Pro feature.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Invite Member</h2>

      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          className="flex-1 rounded border px-3 py-2"
          disabled={disabled}
        />
        <select
          className="rounded border px-3 py-2 text-sm"
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
        <button
          onClick={submit}
          disabled={disabled}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Invite
        </button>
      </div>

      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  )
}

// app/dashboard/[workspaceSlug]/members/MembersClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import InviteMemberForm from './InviteMemberForm'
import MemberList, { MemberRow } from './MemberList'

type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'

function isManager(role: Role) {
  return role === 'OWNER' || role === 'ADMIN'
}

export default function MembersClient({
  workspaceId,
  workspaceName,
  currentRole,
  plan = 'Free',
}: {
  workspaceId: string
  workspaceName: string
  currentRole: Role
  plan?: 'Free' | 'Basic' | 'Pro' | 'Elite'
}) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canManage = useMemo(() => isManager(currentRole), [currentRole])

  async function loadMembers() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as {
        members?: MemberRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data?.error || 'Failed to load members')
      setMembers(data.members ?? [])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load members'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Team Members</h1>
        <p className="text-muted-foreground text-sm">
          Workspace: <span className="font-medium">{workspaceName}</span>
        </p>
      </div>

      {canManage ? (
        <InviteMemberForm
          workspaceId={workspaceId}
          currentRole={currentRole}
          plan={plan}
          onSuccess={loadMembers}
        />
      ) : (
        <div className="text-muted-foreground rounded-lg border p-4 text-sm">
          You can view members, but only Owners/Admins can invite or manage
          roles.
        </div>
      )}

      {error ? (
        <div className="rounded-lg border p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <MemberList
        workspaceId={workspaceId}
        currentRole={currentRole}
        plan={plan}
        members={members}
        loading={loading}
        onChanged={loadMembers}
      />
    </div>
  )
}

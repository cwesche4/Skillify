'use client'

import { useWorkspaceTeam } from '@/components/team/useWorkspaceTeam'
import { MembersTable } from '@/components/team/MembersTable'
import { InvitesPanel } from '@/components/team/InvitesPanel'

export default function TeamMembersClient({
  workspaceId,
  canManage,
}: {
  workspaceId: string
  canManage: boolean
}) {
  const { members, invites, loading, error, refresh } =
    useWorkspaceTeam(workspaceId)

  if (loading) {
    return (
      <div className="text-neutral-text-secondary dark:bg-neutral-card-dark rounded-2xl border border-neutral-border bg-white p-6 text-sm">
        Loading team…
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-neutral-text-secondary dark:bg-neutral-card-dark rounded-2xl border border-neutral-border bg-white p-6 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <MembersTable
        workspaceId={workspaceId}
        canManage={canManage}
        members={members}
        onChanged={refresh}
      />
      <InvitesPanel
        workspaceId={workspaceId}
        canManage={canManage}
        invites={invites}
        onChanged={refresh}
      />
    </div>
  )
}

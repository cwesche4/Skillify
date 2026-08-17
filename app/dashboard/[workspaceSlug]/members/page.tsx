// app/dashboard/[workspaceSlug]/members/page.tsx
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { planAtLeast } from '@/lib/subscriptions/features'
import { redirect } from 'next/navigation'
import MemberList from '../settings/members/MemberList'
import { PendingInvitationsList } from '../settings/members/PendingInvitationsList'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { WorkspaceTeamsPanel } from '@/components/workspace-structure/WorkspaceTeamsPanel'

type PageProps = { params: { workspaceSlug: string } }

export default async function MembersPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: { include: { user: true } },
      invites: {
        where: {
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!workspace) return null

  const membership = workspace.members.find((m) => m.user.clerkId === userId)
  if (!membership) {
    redirect('/dashboard')
  }

  const plan = await getWorkspacePlan(workspace.id, userId)
  const role = membership.role
  if (!planAtLeast(plan, 'Basic')) {
    redirect(
      `/dashboard/${params.workspaceSlug}/upsell?need=Basic&feature=Members`,
    )
  }
  if (role !== 'OWNER' && role !== 'ADMIN') {
    return (
      <DashboardShell>
        <PageHeader
          title="Members"
          description="Manage workspace access, permissions, and invitations."
        />
        <EmptyState
          title="Access denied"
          description="Member management is available to workspace owners and admins."
        />
      </DashboardShell>
    )
  }

  const memberRows = workspace.members.map((m) => ({
    id: m.id,
    role: m.role,
    userId: m.userId,
    fullName: m.user.fullName,
    email: m.user.email,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <DashboardShell>
      <PageHeader
        title="Members and Roles"
        description="Separate active workspace access from pending invitations."
      />
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard label="Active Members" value={memberRows.length} />
          <SummaryCard
            label="Pending Invitations"
            value={workspace.invites.length}
          />
        </div>
        <MemberList
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          currentRole={role}
          members={memberRows}
        />
        <PendingInvitationsList
          workspaceId={workspace.id}
          currentRole={role}
          invites={workspace.invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            status: 'pending',
            expiresAt: invite.expiresAt.toISOString(),
            createdAt: invite.createdAt.toISOString(),
          }))}
        />
        <WorkspaceTeamsPanel
          workspaceId={workspace.id}
          canManage={role === 'OWNER' || role === 'ADMIN'}
          members={memberRows.map((member) => ({
            id: member.id,
            label: member.fullName ?? member.email ?? 'Unnamed member',
            email: member.email,
          }))}
        />
      </div>
    </DashboardShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
      <div className="text-neutral-text-secondary text-xs font-medium uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-100">
        {value}
      </div>
    </div>
  )
}

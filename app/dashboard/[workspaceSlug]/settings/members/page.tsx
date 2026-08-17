// app/dashboard/[workspaceSlug]/settings/members/page.tsx
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import InviteMemberForm from './InviteMemberForm'
import MemberList from './MemberList'
import { PendingInvitationsList } from './PendingInvitationsList'
import { planAtLeast } from '@/lib/subscriptions/features'
import { redirect } from 'next/navigation'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

type PageProps = { params: { workspaceSlug: string } }

export default async function MembersSettingsPage({ params }: PageProps) {
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

  const member = workspace.members.find((m) => m.user.clerkId === userId)
  const currentRole = member?.role ?? 'MEMBER'
  const plan = await getWorkspacePlan(workspace.id, userId)
  if (!planAtLeast(plan, 'Basic')) {
    redirect(
      `/dashboard/${params.workspaceSlug}/upsell?need=Basic&feature=Members`,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Members and Roles</h1>
        <p className="text-neutral-text-secondary mt-1 text-sm">
          Active workspace access and pending invitations are tracked
          separately.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Active Members" value={workspace.members.length} />
        <SummaryCard
          label="Pending Invitations"
          value={workspace.invites.length}
        />
      </div>

      {currentRole === 'OWNER' || currentRole === 'ADMIN' ? (
        <InviteMemberForm
          workspaceId={workspace.id}
          currentRole={currentRole}
          plan={plan}
        />
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Member management is restricted to workspace owners and admins.
        </div>
      )}

      <MemberList
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        currentRole={currentRole}
        members={workspace.members.map((m) => ({
          id: m.id,
          role: m.role,
          userId: m.userId,
          fullName: m.user.fullName,
          email: m.user.email,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
      <PendingInvitationsList
        workspaceId={workspace.id}
        currentRole={currentRole}
        invites={workspace.invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: 'pending',
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        }))}
      />
    </div>
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

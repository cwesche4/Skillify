// app/dashboard/[workspaceSlug]/members/page.tsx
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Badge } from '@/components/ui/Badge'

type MembersPageProps = {
  params: { workspaceSlug: string }
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        include: {
          user: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
      </DashboardShell>
    )
  }

  // ------------------------------
  // FIX: add explicit type to 'm'
  // ------------------------------
  const isMember = workspace.members.some(
    (m: { userId: string }) => m.userId === profile.id,
  )

  if (!isMember) {
    return (
      <DashboardShell>
        <h1 className="h2">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </DashboardShell>
    )
  }

  // ------------------------------
  // FIX: map callback typed
  // ------------------------------
  const clerkUsers = await Promise.all(
    workspace.members.map((m: { user: { clerkId: string } }) =>
      clerkClient.users.getUser(m.user.clerkId),
    ),
  )

  const clerkUserMap = new Map<string, any>()
  clerkUsers.forEach((u: any) => clerkUserMap.set(u.id, u))

  return (
    <DashboardShell>
      <h1 className="h2 mb-6">Workspace Members</h1>

      <div className="space-y-4">
        {/* FIX: member callback typed */}
        {workspace.members.map((member: any) => {
          const clerkUser = clerkUserMap.get(member.user.clerkId)

          const fullName =
            clerkUser?.firstName || clerkUser?.lastName
              ? `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
              : 'Unknown User'

          const email =
            clerkUser?.primaryEmailAddress?.emailAddress ??
            clerkUser?.emailAddresses?.[0]?.emailAddress ??
            'No email'

          return (
            <div
              key={member.id}
              className="flex items-center justify-between border-b border-neutral-border pb-3 last:border-none"
            >
              <div>
                <p className="font-medium">{fullName}</p>
                <p className="text-neutral-text-secondary text-xs">{email}</p>
              </div>

              <Badge
                variant={
                  member.role === 'OWNER'
                    ? 'purple'
                    : member.role === 'ADMIN'
                      ? 'blue'
                      : 'gray'
                }
              >
                {member.role}
              </Badge>
            </div>
          )
        })}
      </div>
    </DashboardShell>
  )
}

import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import InviteMemberForm from './InviteMemberForm'
import MemberList from './MemberList'

type PageParams = { params: { workspaceSlug: string } }

export default async function MembersPage({ params }: PageParams) {
  const { userId } = auth()
  if (!userId) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: { include: { user: true } },
    },
  })

  if (!workspace) return null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Team Members</h1>
      <InviteMemberForm workspaceId={workspace.id} />
      <MemberList members={workspace.members} />
    </div>
  )
}

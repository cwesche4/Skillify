import { RecurringServicesClient } from '@/components/dashboard/recurring-services/RecurringServicesClient'
import { prisma } from '@/lib/db'
import { canManageSchedulingRole } from '@/lib/scheduling/loadSchedulingPageProps'
import { requireSchedulingSectionAccess } from '@/lib/scheduling/routeGuards'
import { getPersistedSchedulingSettings } from '@/lib/scheduling/services/schedulingService'

type PageProps = {
  params: { workspaceSlug: string }
  searchParams: { recurringServiceId?: string | string[] }
}

export default async function SchedulingRecurringServicesPage({
  params,
  searchParams,
}: PageProps) {
  const { workspace, capabilities, membership } =
    await requireSchedulingSectionAccess({
      workspaceSlug: params.workspaceSlug,
      section: 'recurringServices',
    })
  const settings = await getPersistedSchedulingSettings({
    workspaceId: workspace.id,
    businessModel: workspace.businessModel,
    capabilities: capabilities.scheduling,
  })
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      role: true,
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return (
    <RecurringServicesClient
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      timezone={settings.timezone}
      canManage={canManageSchedulingRole(membership.role)}
      initialRecurringServiceId={
        typeof searchParams.recurringServiceId === 'string'
          ? searchParams.recurringServiceId
          : null
      }
      members={members.map((member) => ({
        id: member.id,
        role: member.role,
        name: member.user.fullName || member.user.email || 'Workspace member',
      }))}
    />
  )
}

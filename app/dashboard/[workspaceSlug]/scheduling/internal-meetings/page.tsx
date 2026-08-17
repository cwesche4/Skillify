import { SchedulingPage } from '@/components/scheduling/SchedulingPage'
import {
  canManageSchedulingRole,
  loadSchedulingPageProps,
} from '@/lib/scheduling/loadSchedulingPageProps'
import { requireSchedulingSectionAccess } from '@/lib/scheduling/routeGuards'

type PageProps = { params: { workspaceSlug: string } }

export default async function SchedulingInternalMeetingsPage({
  params,
}: PageProps) {
  const { workspace, capabilities, membership } =
    await requireSchedulingSectionAccess({
      workspaceSlug: params.workspaceSlug,
      section: 'internalMeetings',
    })
  const initialData = await loadSchedulingPageProps({
    workspace: workspace as any,
    capabilities: capabilities.scheduling,
  })
  return (
    <SchedulingPage
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      businessModel={(workspace as any).businessModel}
      initialCapabilities={capabilities.scheduling}
      {...initialData}
      section="internalMeetings"
      canManage={canManageSchedulingRole(membership.role)}
      schedulingAIEnabled={process.env.SCHEDULING_AI_ENABLED === 'true'}
    />
  )
}

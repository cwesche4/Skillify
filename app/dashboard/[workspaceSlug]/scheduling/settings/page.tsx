import { SchedulingPage } from '@/components/scheduling/SchedulingPage'
import {
  canManageSchedulingRole,
  loadSchedulingPageProps,
} from '@/lib/scheduling/loadSchedulingPageProps'
import { requireSchedulingAccess } from '@/lib/scheduling/routeGuards'

type PageProps = { params: { workspaceSlug: string } }

export default async function SchedulingSettingsPage({ params }: PageProps) {
  const { workspace, capabilities, membership } = await requireSchedulingAccess(
    {
      workspaceSlug: params.workspaceSlug,
    },
  )
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
      section="settings"
      canManage={canManageSchedulingRole(membership.role)}
      schedulingAIEnabled={process.env.SCHEDULING_AI_ENABLED === 'true'}
    />
  )
}

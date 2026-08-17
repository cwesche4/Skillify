import { FulfillmentPage as FulfillmentWorkspacePage } from '@/components/commerce/FulfillmentPage'
import { requireCommerceModuleAccess } from '@/lib/commerce/routeGuards'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function FulfillmentPage({ params }: PageProps) {
  const { workspace, membership } = await requireCommerceModuleAccess({
    workspaceSlug: params.workspaceSlug,
    capability: 'fulfillment',
  })
  const role = String(membership.role).toLowerCase()

  return (
    <FulfillmentWorkspacePage
      workspaceId={workspace.id}
      canEdit={role === 'owner' || role === 'admin'}
    />
  )
}

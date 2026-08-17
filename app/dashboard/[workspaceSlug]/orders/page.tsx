import { OrdersPage as OrdersWorkspacePage } from '@/components/commerce/OrdersPage'
import { requireCommerceModuleAccess } from '@/lib/commerce/routeGuards'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function OrdersPage({ params }: PageProps) {
  const { workspace, membership } = await requireCommerceModuleAccess({
    workspaceSlug: params.workspaceSlug,
    capability: 'orders',
  })
  const role = String(membership.role).toLowerCase()

  return (
    <OrdersWorkspacePage
      workspaceId={workspace.id}
      canEdit={role === 'owner' || role === 'admin'}
    />
  )
}

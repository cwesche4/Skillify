import { CommerceCustomersPage } from '@/components/commerce/CommerceCustomersPage'
import { requireCommerceModuleAccess } from '@/lib/commerce/routeGuards'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function CustomersPage({ params }: PageProps) {
  const { workspace, membership } = await requireCommerceModuleAccess({
    workspaceSlug: params.workspaceSlug,
    capability: 'customers',
  })
  const role = String(membership.role).toLowerCase()

  return (
    <CommerceCustomersPage
      workspaceId={workspace.id}
      canEdit={role === 'owner' || role === 'admin'}
    />
  )
}

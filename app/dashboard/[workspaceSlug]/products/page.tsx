import { ProductCatalogPage } from '@/components/commerce/ProductCatalogPage'
import { requireCommerceModuleAccess } from '@/lib/commerce/routeGuards'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function ProductsPage({ params }: PageProps) {
  const { workspace, membership } = await requireCommerceModuleAccess({
    workspaceSlug: params.workspaceSlug,
    capability: 'products',
  })
  const role = String(membership.role).toLowerCase()

  return (
    <ProductCatalogPage
      workspaceId={workspace.id}
      canEdit={role === 'owner' || role === 'admin'}
    />
  )
}

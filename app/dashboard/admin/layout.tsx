import { AdminForbidden } from '@/components/admin/AdminForbidden'
import { GlobalAdminLayout } from '@/components/admin/GlobalAdminLayout'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getGlobalAdminProfile()

  if (!admin) {
    return <AdminForbidden />
  }

  const backHref = admin.firstWorkspace?.slug
    ? `/dashboard/${admin.firstWorkspace.slug}`
    : '/dashboard'

  return <GlobalAdminLayout backHref={backHref}>{children}</GlobalAdminLayout>
}

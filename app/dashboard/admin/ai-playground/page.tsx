import { notFound, redirect } from 'next/navigation'

import { AdminForbidden } from '@/components/admin/AdminForbidden'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'
import { isAIPlaygroundEnabled } from '@/lib/ai/playground/aiPlayground'

export default async function GlobalAIPlaygroundRedirectPage() {
  if (!isAIPlaygroundEnabled()) notFound()

  const admin = await getGlobalAdminProfile()
  if (!admin) {
    return <AdminForbidden />
  }

  if (!admin.firstWorkspace?.slug) {
    redirect('/dashboard/admin')
  }

  redirect(`/dashboard/${admin.firstWorkspace.slug}/admin/ai-playground`)
}

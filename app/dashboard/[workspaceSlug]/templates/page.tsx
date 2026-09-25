import { redirect } from 'next/navigation'

export default function TemplatesPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  redirect(`/dashboard/${params.workspaceSlug}/automations/advanced/templates`)
}

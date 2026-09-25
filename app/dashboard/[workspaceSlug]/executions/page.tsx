import { redirect } from 'next/navigation'

export default function ExecutionsPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  redirect(`/dashboard/${params.workspaceSlug}/automations/advanced/executions`)
}

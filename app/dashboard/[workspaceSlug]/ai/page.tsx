import { redirect } from 'next/navigation'

export default function LegacyAiCoachPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  redirect(`/dashboard/${params.workspaceSlug}/ai-coach`)
}

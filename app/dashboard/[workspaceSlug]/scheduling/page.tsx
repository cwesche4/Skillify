import { redirect } from 'next/navigation'

type PageProps = {
  params: { workspaceSlug: string }
}

export default function SchedulingIndexPage({ params }: PageProps) {
  redirect(`/dashboard/${params.workspaceSlug}/scheduling/calendar`)
}

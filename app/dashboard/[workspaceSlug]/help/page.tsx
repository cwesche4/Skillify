import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'

export default function HelpPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  return (
    <DashboardShell>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Help & Docs</h1>
        <p className="text-neutral-text-secondary text-sm">
          Resource hub for workspace <strong>{params.workspaceSlug}</strong>.
        </p>

        <Card className="space-y-2 p-5">
          <h3 className="text-sm font-semibold">Documentation</h3>
          <p className="text-neutral-text-secondary text-xs">
            Link your docs, FAQs, or onboarding materials here. No redirects are
            triggered; this is a safe placeholder page.
          </p>
        </Card>
      </div>
    </DashboardShell>
  )
}

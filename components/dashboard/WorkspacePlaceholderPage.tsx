import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'

export function WorkspacePlaceholderPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  title: string
  description: string
  emptyTitle?: string
  emptyDescription?: string
}) {
  return (
    <DashboardShell>
      <PageHeader title={title} description={description} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5">
          <EmptyState
            title={emptyTitle ?? `${title} is coming soon`}
            description={
              emptyDescription ??
              'This workspace section is scaffolded and ready for future tools, data, and workflows.'
            }
          />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-neutral-100">
              Workspace ready
            </h2>
            <p className="text-neutral-text-secondary mt-2 text-xs leading-5">
              This section is wired into the workspace shell, navigation, and
              route structure.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-neutral-100">
              Built for expansion
            </h2>
            <p className="text-neutral-text-secondary mt-2 text-xs leading-5">
              The dashboard card and grid patterns can support KPIs, activity,
              AI insights, tasks, notifications, and calendar widgets.
            </p>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}

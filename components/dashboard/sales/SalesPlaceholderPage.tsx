import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { ownershipLabels } from '@/lib/ownership-labels'

type SalesMetric = {
  label: string
  value: string
  helper: string
}

type SalesRecord = {
  name: string
  company: string
  status: string
  stage: string
  value: string
  nextStep: string
  owner: string
  badgeVariant?: BadgeVariant
}

type SalesPlaceholderPageProps = {
  title: string
  description: string
  metrics: SalesMetric[]
  records: SalesRecord[]
  emptyTitle: string
  emptyDescription: string
  stageOptions: string[]
  statusOptions: string[]
}

export function SalesPlaceholderPage({
  title,
  description,
  metrics,
  records,
  emptyTitle,
  emptyDescription,
  stageOptions,
  statusOptions,
}: SalesPlaceholderPageProps) {
  return (
    <DashboardShell className="max-w-7xl">
      <div className="space-y-5">
        <PageHeader title={title} description={description} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="p-4">
              <p className="text-neutral-text-secondary text-xs">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-100">
                {metric.value}
              </p>
              <p className="text-neutral-text-secondary mt-1 text-xs">
                {metric.helper}
              </p>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
              <Input placeholder={`Search ${title.toLowerCase()}...`} />
              <Select defaultValue="All" aria-label="Status filter">
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select defaultValue="All" aria-label="Stage filter">
                {stageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{title} Workspace</CardTitle>
                <p className="text-neutral-text-secondary mt-1 text-sm">
                  Mock sales data for planning the future CRM workflow.
                </p>
              </div>
              <Badge variant="slate">Demo data</Badge>
            </div>
          </CardHeader>
          {records.length > 0 ? (
            <Table
              className="min-w-[980px]"
              containerClassName="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/70 hover:scrollbar-thumb-cyan-400/60 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-950/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/60"
            >
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Status</TH>
                  <TH>Stage</TH>
                  <TH>Value</TH>
                  <TH>Next Step</TH>
                  <TH>{ownershipLabels.opportunities.table}</TH>
                </TR>
              </THead>
              <TBody>
                {records.map((record) => (
                  <TR key={`${record.name}-${record.company}`}>
                    <TD>
                      <div className="min-w-56">
                        <p className="font-medium text-neutral-100">
                          {record.name}
                        </p>
                        <p className="text-neutral-text-secondary mt-0.5 text-xs">
                          {record.company}
                        </p>
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={record.badgeVariant ?? 'blue'}>
                        {record.status}
                      </Badge>
                    </TD>
                    <TD className="text-neutral-text-secondary">
                      {record.stage}
                    </TD>
                    <TD>{record.value}</TD>
                    <TD className="text-neutral-text-secondary">
                      {record.nextStep}
                    </TD>
                    <TD className="text-neutral-text-secondary">
                      {record.owner}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="p-4">
              <EmptyState title={emptyTitle} description={emptyDescription} />
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  )
}

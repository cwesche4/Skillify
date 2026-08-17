import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { WorkspaceMemberRole } from '@prisma/client'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { prisma } from '@/lib/db'

type PageProps = {
  params: { workspaceSlug: string }
  searchParams?: Record<string, string | string[] | undefined>
}

function parseParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

function buildQuery(
  workspaceId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const qs = new URLSearchParams()
  const map = {
    from: parseParam(searchParams.from),
    to: parseParam(searchParams.to),
    actorUserId: parseParam(searchParams.actorUserId),
    action: parseParam(searchParams.action),
    nodeId: parseParam(searchParams.nodeId),
    automationId: parseParam(searchParams.automationId),
    wasDenied: parseParam(searchParams.wasDenied),
  }

  Object.entries(map).forEach(([key, val]) => {
    if (val) qs.set(key, val)
  })

  const base = `/api/workspaces/${workspaceId}/ai-actions/audit`
  const query = qs.toString()
  return query ? `${base}?${query}` : base
}

export default async function AiActionsAuditPage({
  params,
  searchParams = {},
}: PageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { user: { clerkId } } },
    },
    select: {
      id: true,
      name: true,
      members: {
        where: { user: { clerkId } },
        select: { role: true },
      },
    },
  })

  if (!workspace) redirect('/dashboard')

  const role = workspace.members[0]?.role
  const isAdmin =
    role === WorkspaceMemberRole.ADMIN || role === WorkspaceMemberRole.OWNER
  if (!isAdmin) redirect(`/dashboard/${params.workspaceSlug}`)

  const queryUrl = buildQuery(workspace.id, searchParams)
  const res = await fetch(queryUrl, { cache: 'no-store' })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to load audits')
    return (
      <DashboardShell>
        <div className="space-y-4">
          <header>
            <h1 className="text-xl font-semibold text-slate-50">
              AI Action Audits
            </h1>
            <p className="text-sm text-slate-400">
              Server-filtered audit view for workspace admins.
            </p>
          </header>
          <Card className="p-4 text-sm text-rose-400">
            Error loading audits: {errorText || res.statusText}
          </Card>
        </div>
      </DashboardShell>
    )
  }

  const { audits = [] } = await res.json().catch(() => ({ audits: [] }))
  const baseExport = buildQuery(workspace.id, searchParams).replace(
    '/ai-actions/audit',
    '/ai-actions/audit/export',
  )

  const actionOptions = Array.from(
    new Set((audits as any[]).map((a) => a.action).filter(Boolean)),
  ).sort()

  return (
    <DashboardShell>
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">
              AI Action Audits
            </h1>
            <p className="text-sm text-slate-400">
              Workspace: {workspace.name}. Filters are applied on the server.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/dashboard/${params.workspaceSlug}/settings/ai-actions`}
            >
              Kill switch
            </Link>
          </Button>
        </header>

        <Card className="space-y-3 p-4">
          <form className="grid gap-3 md:grid-cols-3" method="get">
            <div>
              <p className="text-neutral-text-secondary mb-1 text-xs">From</p>
              <Input
                type="datetime-local"
                name="from"
                defaultValue={parseParam(searchParams.from)}
              />
            </div>
            <div>
              <p className="text-neutral-text-secondary mb-1 text-xs">To</p>
              <Input
                type="datetime-local"
                name="to"
                defaultValue={parseParam(searchParams.to)}
              />
            </div>
            <Select
              name="action"
              defaultValue={parseParam(searchParams.action) ?? ''}
            >
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Input
              name="actorUserId"
              placeholder="Actor user ID"
              defaultValue={parseParam(searchParams.actorUserId)}
            />
            <Input
              name="automationId"
              placeholder="Automation ID"
              defaultValue={parseParam(searchParams.automationId)}
            />
            <Input
              name="nodeId"
              placeholder="Node ID"
              defaultValue={parseParam(searchParams.nodeId)}
            />
            <Select
              name="wasDenied"
              defaultValue={parseParam(searchParams.wasDenied) ?? ''}
            >
              <option value="">All outcomes</option>
              <option value="false">Applied</option>
              <option value="true">Denied</option>
            </Select>

            <div className="flex justify-end gap-2 md:col-span-3">
              <Button type="submit" size="sm" variant="primary">
                Apply filters
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/dashboard/${params.workspaceSlug}/admin/audits/ai-actions`}
                >
                  Reset
                </Link>
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-neutral-text-secondary text-xs">
              Exports reflect AI actions at time of generation. Exports cannot
              be modified after download. No live data is altered by exporting.
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={baseExport}>Export CSV</Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded border border-slate-800/60">
            <Table>
              <THead>
                <TR>
                  <TH>Timestamp</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Automation</TH>
                  <TH>Node</TH>
                  <TH>Status</TH>
                  <TH>Reason</TH>
                </TR>
              </THead>
              <TBody>
                {audits.length === 0 ? (
                  <TR>
                    <TD
                      colSpan={7}
                      className="text-neutral-text-secondary text-center text-sm"
                    >
                      No audit entries match the current filters.
                    </TD>
                  </TR>
                ) : (
                  (audits as any[]).map((a) => (
                    <TR key={a.id}>
                      <TD className="text-neutral-text-secondary text-xs">
                        {a.createdAt ? new Date(a.createdAt).toISOString() : ''}
                      </TD>
                      <TD className="text-xs">{a.actorUserId}</TD>
                      <TD className="text-xs">
                        <Badge variant="blue">{a.action}</Badge>
                      </TD>
                      <TD className="text-xs">{a.automationId || '—'}</TD>
                      <TD className="text-xs">{a.nodeId || '—'}</TD>
                      <TD className="text-xs">
                        {a.wasDenied ? (
                          <Badge variant="red">Denied</Badge>
                        ) : (
                          <Badge variant="green">Applied</Badge>
                        )}
                      </TD>
                      <TD className="text-neutral-text-secondary text-xs">
                        {a.reason || '—'}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}

// app/dashboard/[workspaceSlug]/settings/audit/page.tsx
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'

type PageProps = {
  params: { workspaceSlug: string }
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function AuditLogPage({
  params,
  searchParams = {},
}: PageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        where: { user: { clerkId } },
        select: { id: true, role: true, userId: true },
      },
    },
  })

  if (!workspace) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Workspace not found</h1>
      </div>
    )
  }

  const membership = workspace.members[0]
  if (!membership) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </div>
    )
  }

  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const action =
    typeof searchParams.action === 'string' ? searchParams.action : undefined
  const cursor =
    typeof searchParams.cursor === 'string' ? searchParams.cursor : undefined
  const limit = 50

  const where: any = { workspaceId: workspace.id }
  if (action) where.action = action

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      actor: {
        select: { fullName: true, email: true, id: true },
      },
    },
  })

  const filtered = q
    ? logs.filter((log) => {
        const metaStr = log.meta ? JSON.stringify(log.meta).toLowerCase() : ''
        return (
          log.action.toLowerCase().includes(q.toLowerCase()) ||
          log.targetType.toLowerCase().includes(q.toLowerCase()) ||
          metaStr.includes(q.toLowerCase())
        )
      })
    : logs

  const hasMore = filtered.length > limit
  const items = filtered.slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined
  const availableActions = Array.from(new Set(logs.map((l) => l.action))).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="text-neutral-text-secondary text-sm">
            Workspace-wide audit entries, newest first. CRM webhooks, actions,
            and security events land here.
          </p>
        </div>
      </div>

      <div className="border-neutral-border/70 bg-neutral-card-dark/60 text-neutral-text-secondary rounded-lg border p-4 text-xs">
        <p className="text-neutral-text font-semibold">
          AI action export disclosure
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Exports reflect AI actions at time of generation.</li>
          <li>Exports cannot be modified after download.</li>
          <li>No live data is altered by exporting.</li>
        </ul>
      </div>

      <Card className="space-y-3 p-4">
        <form className="grid gap-3 md:grid-cols-3" method="get">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search action/target/meta"
            className="md:col-span-2"
          />
          <Select name="action" defaultValue={action ?? ''}>
            <option value="">All actions</option>
            {availableActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <div className="flex justify-end md:col-span-3">
            <Button type="submit" size="sm" variant="primary">
              Apply filters
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Target</TH>
              <TH>Actor</TH>
              <TH>Meta</TH>
            </TR>
          </THead>
          <TBody>
            {items.length === 0 && (
              <TR>
                <TD
                  colSpan={5}
                  className="text-neutral-text-secondary text-center text-sm"
                >
                  No audit entries yet.
                </TD>
              </TR>
            )}
            {items.map((item) => (
              <TR key={item.id}>
                <TD className="text-neutral-text-secondary whitespace-nowrap text-xs">
                  {item.createdAt.toISOString()}
                </TD>
                <TD>
                  <Badge variant="blue">{item.action}</Badge>
                </TD>
                <TD className="text-xs">
                  {item.targetType}
                  {item.targetId ? ` • ${item.targetId}` : ''}
                </TD>
                <TD className="text-xs">
                  {item.actor?.fullName || '—'}
                  {item.actor?.email ? ` (${item.actor.email})` : ''}
                </TD>
                <TD className="text-neutral-text-secondary max-w-[360px] text-xs">
                  {item.meta ? JSON.stringify(item.meta).slice(0, 180) : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {nextCursor && (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline" className="text-xs">
            <a
              href={`/dashboard/${params.workspaceSlug}/settings/audit?cursor=${nextCursor}${action ? `&action=${encodeURIComponent(action)}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            >
              Next page
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

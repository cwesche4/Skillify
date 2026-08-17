import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { OperatorActions } from '@/components/integrations/OperatorActions'
import { resolveIntegrationCapabilities } from '@/lib/integrations/capabilities'
import { resolveIntegrationHealth } from '@/lib/integrations/health'
import {
  resolveLeadIntakeSourceCards,
  type LeadIntakeCardStatus,
} from '@/lib/integrations/leadIntake'
import {
  resolveNotificationChannelAvailability,
  type NotificationChannel,
} from '@/lib/integrations/notificationChannels'
import {
  clearCircuitBreaker,
  softDisableIntegration,
  rerunLastFailedAction,
} from '@/lib/integrations/ops'
import {
  listIntegrationProviderAvailability,
  type IntegrationConnectionStatus,
} from '@/lib/integrations/providerRegistry'
import { listWorkspaceIntegrationConnections } from '@/lib/integrations/workspaceConnections'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function IntegrationsPage({ params }: PageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        where: { userId: profile.id },
        select: { id: true, role: true },
      },
      integrations: true,
    },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
      </DashboardShell>
    )
  }

  const isMember = workspace.members.length > 0
  if (!isMember) {
    return (
      <DashboardShell>
        <h1 className="h2">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </DashboardShell>
    )
  }

  const planLabel = profile.subscription?.plan ?? 'Free'
  const proOrAbove = planLabel === 'Pro' || planLabel === 'Elite'
  const elite = planLabel === 'Elite'
  const role = workspace.members[0]?.role
  const isManager = role === 'OWNER' || role === 'ADMIN'
  const providerAvailability = listIntegrationProviderAvailability({
    workspaceId: workspace.id,
  }).filter(
    (provider) =>
      provider.credentialOwnership !== 'platform' ||
      provider.category === 'email',
  )
  const workspaceConnections = await listWorkspaceIntegrationConnections({
    workspaceId: workspace.id,
  })
  const statusVariant = (status: IntegrationConnectionStatus) => {
    if (status === 'connected') return 'green' as const
    if (status === 'configurationRequired' || status === 'actionRequired')
      return 'yellow' as const
    if (status === 'error' || status === 'revoked' || status === 'expired')
      return 'red' as const
    if (status === 'comingSoon') return 'purple' as const
    return 'gray' as const
  }
  const healthVariant = (
    state: ReturnType<typeof resolveIntegrationHealth>['state'],
  ) => {
    if (state === 'healthy') return 'green' as const
    if (state === 'degraded' || state === 'actionRequired')
      return 'yellow' as const
    if (
      state === 'expired' ||
      state === 'reconnectRequired' ||
      state === 'error'
    ) {
      return 'red' as const
    }
    return 'gray' as const
  }
  const formatDateTime = (date: Date | null) =>
    date ? date.toISOString().slice(0, 16).replace('T', ' ') : 'Not checked'
  const notificationChannels: NotificationChannel[] = [
    'inApp',
    'email',
    'sms',
    'slack',
  ]
  const notificationAvailability = notificationChannels.map((channel) =>
    resolveNotificationChannelAvailability({
      channel,
      enabled: channel === 'inApp',
      workspaceConnections,
      platformEmailAvailable: Boolean(
        process.env.RESEND_API_KEY && process.env.EMAIL_FROM,
      ),
    }),
  )
  const leadIntakeSources = resolveLeadIntakeSourceCards({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    connections: workspaceConnections,
  })
  const leadIntakeVariant = (status: LeadIntakeCardStatus) => {
    if (status === 'connected' || status === 'ready') return 'green' as const
    if (status === 'selected') return 'brand' as const
    if (
      status === 'partial' ||
      status === 'configurationRequired' ||
      status === 'actionRequired'
    ) {
      return 'yellow' as const
    }
    if (status === 'comingSoon') return 'purple' as const
    return 'gray' as const
  }

  // Usage counters (read-only, from audit logs)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const usage = elite
    ? {
        webhooks24: await prisma.auditLog.count({
          where: {
            workspaceId: workspace.id,
            action: 'CRM_WEBHOOK_RECEIVED',
            createdAt: { gte: since },
          },
        }),
        actions24: await prisma.auditLog.count({
          where: {
            workspaceId: workspace.id,
            action: 'CRM_ACTION_EXECUTED',
            createdAt: { gte: since },
          },
        }),
        rateEvents24: await prisma.auditLog.count({
          where: {
            workspaceId: workspace.id,
            action: {
              in: [
                'CRM_WEBHOOK_RATE_LIMITED',
                'CRM_ACTION_RATE_LIMITED',
                'CRM_CIRCUIT_OPENED',
              ],
            },
            createdAt: { gte: since },
          },
        }),
      }
    : null

  // Fetch integration health for managers
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
  const healthByIntegration =
    isManager && workspace.integrations.length
      ? await Promise.all(
          workspace.integrations.map(async (integration) => {
            try {
              const res = await fetch(
                `${baseUrl}/api/integrations/${integration.provider}/health?workspaceId=${workspace.id}`,
                { cache: 'no-store' },
              )
              if (!res.ok) return { id: integration.id, error: 'Unavailable' }
              const json = await res.json()
              return { id: integration.id, ...json }
            } catch {
              return { id: integration.id, error: 'Unavailable' }
            }
          }),
        )
      : []

  // CRM activity timeline (Elite-only, per integration, read-only)
  const timelineByIntegration =
    elite && isManager && workspace.integrations.length
      ? await Promise.all(
          workspace.integrations.map(async (integration) => {
            const entries = await prisma.auditLog.findMany({
              where: {
                workspaceId: workspace.id,
                action: { startsWith: 'CRM_' },
                OR: [
                  { targetId: integration.id },
                  {
                    meta: {
                      path: ['integrationId'],
                      equals: integration.id,
                    } as any,
                  },
                ],
              },
              orderBy: { createdAt: 'desc' },
              take: 30,
            })
            return { id: integration.id, entries }
          }),
        )
      : []

  // Operator actions are Elite-only; we provide client-side triggers with confirmation.
  // Inline client logic below keeps SSR data fetching minimal.

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          Integrations
        </h1>
        <p className="text-neutral-text-secondary text-sm">
          Manage workspace-owned provider connections and Skillify platform
          provider availability from one place.
        </p>
        <p className="text-neutral-text-secondary text-xs">
          Customer credentials are encrypted per workspace. Platform credentials
          stay in Skillify server configuration.
        </p>
        <div className="mt-2 flex gap-2">
          <Badge variant={proOrAbove ? 'green' : 'yellow'}>
            Plan: {planLabel}
          </Badge>
          {!proOrAbove && (
            <Link
              href={`/dashboard/${params.workspaceSlug}/upsell?need=Pro`}
              className="text-xs text-brand-primary underline"
            >
              Upgrade to enable CRM integrations
            </Link>
          )}
          {proOrAbove && !elite && (
            <span className="text-neutral-text-secondary text-xs">
              Webhooks require Elite.
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {providerAvailability.map((provider) => {
          const connections = workspaceConnections.filter(
            (connection) => connection.providerId === provider.providerId,
          )
          const connected = connections.find(
            (connection) => connection.status === 'connected',
          )
          const effectiveStatus = connected?.status ?? provider.status
          const health = resolveIntegrationHealth({
            providerId: provider.providerId,
            connection: connected ?? null,
            availability: provider,
          })
          const capabilities = resolveIntegrationCapabilities({
            provider,
            availability: provider,
            connection: connected ?? null,
          })
          return (
            <Card key={provider.providerId} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{provider.displayName}</p>
                  <p className="text-neutral-text-secondary text-xs">
                    {provider.customerFacingExplanation}
                  </p>
                </div>
                <Badge variant={statusVariant(effectiveStatus)}>
                  {effectiveStatus}
                </Badge>
              </div>
              <div className="text-neutral-text-secondary space-y-1 text-xs">
                <p>Category: {provider.category}</p>
                <p>Credentials: {provider.credentialOwnership}</p>
                <p>
                  Billing:{' '}
                  {provider.billingResponsibility === 'workspaceCustomer'
                    ? 'Customer-owned account'
                    : provider.billingResponsibility === 'skillify'
                      ? 'Skillify platform'
                      : 'No external billing'}
                </p>
                {connected?.externalAccountLabel && (
                  <p>Connected account: {connected.externalAccountLabel}</p>
                )}
                {provider.missingPlatformEnv.length > 0 && (
                  <p>
                    Skillify deployment configuration required before connect.
                  </p>
                )}
              </div>
              <details className="border-neutral-border/70 rounded-lg border bg-slate-950/30 p-3 text-xs">
                <summary className="text-neutral-text-primary cursor-pointer select-none font-medium">
                  Connection health and capabilities
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={healthVariant(health.state)}>
                      {health.label}
                    </Badge>
                    {health.stale && connected && (
                      <Badge variant="yellow">Needs fresh test</Badge>
                    )}
                  </div>
                  <p className="text-neutral-text-secondary">
                    {health.safeMessage}
                  </p>
                  <div className="text-neutral-text-secondary grid gap-2 sm:grid-cols-2">
                    <p>Last checked: {formatDateTime(health.lastCheckedAt)}</p>
                    <p>
                      Last successful sync:{' '}
                      {formatDateTime(health.lastSuccessfulSyncAt)}
                    </p>
                  </div>
                  {health.requiredAction && (
                    <p className="text-amber-300">
                      Required action: {health.requiredAction}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((capability) => (
                      <Badge
                        key={capability.id}
                        size="xs"
                        variant={capability.available ? 'green' : 'gray'}
                        title={
                          capability.requiredAction ??
                          capability.blockedReason ??
                          undefined
                        }
                      >
                        {capability.label}
                      </Badge>
                    ))}
                  </div>
                  <div className="border-neutral-border/60 text-neutral-text-secondary border-t pt-3">
                    <p>
                      Disconnect impact: future sync and provider-backed
                      delivery stop for this provider. Existing Skillify records
                      remain in the workspace.
                    </p>
                  </div>
                </div>
              </details>
              {connected &&
                provider.testConnection.support === 'supported' &&
                isManager && (
                  <form
                    method="post"
                    action={`/api/workspaces/${workspace.id}/integrations/${provider.providerId}/test`}
                  >
                    <input
                      type="hidden"
                      name="connectionId"
                      value={connected.id}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={!proOrAbove}
                    >
                      Test connection
                    </Button>
                  </form>
                )}
              {provider.testConnection.support !== 'supported' ? (
                <p className="text-neutral-text-secondary text-xs">
                  {provider.testConnection.safeCustomerDescription}
                </p>
              ) : null}
              {provider.providerId === 'resend' ? (
                <p className="text-neutral-text-secondary text-xs">
                  Add or replace the workspace Resend API key through the
                  protected connection API. Saved keys are never displayed.
                </p>
              ) : provider.connectPath && provider.canStartConnection ? (
                <Button
                  asChild
                  size="sm"
                  disabled={!proOrAbove}
                  variant="primary"
                >
                  <Link href={provider.connectPath}>
                    Connect {provider.displayName}
                  </Link>
                </Button>
              ) : (
                <Button size="sm" disabled variant="outline">
                  {provider.status === 'comingSoon'
                    ? 'Coming soon'
                    : provider.status === 'configurationRequired'
                      ? 'Configuration required'
                      : 'Manage in product area'}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      <Card className="mt-6 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-neutral-text-primary text-sm font-semibold">
              Notification channels
            </p>
            <p className="text-neutral-text-secondary text-xs">
              Channel preferences remain separate from provider connection
              state. Provider setup only determines whether a channel can send.
            </p>
          </div>
          <Badge variant="gray">{notificationAvailability.length}</Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {notificationAvailability.map((channel) => (
            <div
              key={channel.channel}
              className="border-neutral-border/70 rounded-lg border bg-slate-950/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold capitalize">
                  {channel.channel === 'inApp' ? 'In-app' : channel.channel}
                </p>
                <Badge variant={channel.available ? 'green' : 'yellow'}>
                  {channel.available ? 'Available' : 'Needs setup'}
                </Badge>
              </div>
              <p className="text-neutral-text-secondary mt-2 text-xs">
                {channel.available
                  ? channel.selectedProvider
                    ? `Provider: ${channel.selectedProvider}`
                    : 'Ready to use.'
                  : (channel.requiredAction ?? channel.blockedReason)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-neutral-text-primary text-sm font-semibold">
              Lead intake sources
            </p>
            <p className="text-neutral-text-secondary text-xs">
              Native forms and provider lead sources share one intake contract.
              Coming-soon providers are listed without fake connection state.
            </p>
          </div>
          <Badge variant="gray">{leadIntakeSources.length}</Badge>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {leadIntakeSources.map((source) => (
            <div
              key={source.id}
              className="border-neutral-border/70 rounded-lg border bg-slate-950/30 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{source.title}</p>
                  <p className="text-neutral-text-secondary text-xs">
                    {source.summary}
                  </p>
                </div>
                <Badge variant={leadIntakeVariant(source.status)}>
                  {source.statusLabel}
                </Badge>
              </div>
              <p className="text-neutral-text-secondary mt-2 text-xs">
                Provider:{' '}
                {source.providerId === 'none' ? 'Skillify' : source.providerId}
              </p>
              {source.action?.href ? (
                <Link
                  href={source.action.href}
                  className="text-neutral-text-primary focus-visible:ring-brand-primary/70 mt-3 inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {source.action.label}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-neutral-text-primary text-sm font-semibold">
            Connected integrations
          </p>
          <Badge variant="gray">{workspace.integrations.length}</Badge>
        </div>

        {workspace.integrations.length === 0 ? (
          <p className="text-neutral-text-secondary text-sm">
            No integrations connected yet.
          </p>
        ) : (
          <div className="space-y-3">
            {workspace.integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between rounded-lg border border-neutral-border p-3"
              >
                <div>
                  <p className="text-sm font-semibold capitalize">
                    {integration.provider}
                  </p>
                  <p className="text-neutral-text-secondary text-xs">
                    Status:{' '}
                    <Badge
                      variant={
                        integration.status === 'connected'
                          ? 'green'
                          : integration.status === 'error'
                            ? 'red'
                            : 'gray'
                      }
                    >
                      {integration.status}
                    </Badge>{' '}
                    • {integration.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form
                    method="post"
                    action={`/api/integrations/${integration.provider}/test`}
                  >
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspace.id}
                    />
                    <input
                      type="hidden"
                      name="integrationId"
                      value={integration.id}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={!proOrAbove}
                    >
                      Test connection
                    </Button>
                  </form>
                  <form
                    method="post"
                    action={`/api/workspaces/${workspace.id}/integrations`}
                  >
                    <input
                      type="hidden"
                      name="integrationId"
                      value={integration.id}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      disabled={!proOrAbove}
                    >
                      Disconnect
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {elite && usage && (
        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-text-primary text-sm font-semibold">
                CRM Usage (last 24h)
              </p>
              <p className="text-neutral-text-secondary text-xs">
                Webhooks, actions, and rate/circuit events from audit logs.
                Read-only.
              </p>
            </div>
            <Badge variant="blue">Elite</Badge>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="border-neutral-border/60 rounded-lg border bg-black/10 p-3">
              <p className="text-neutral-text-secondary text-xs">
                Webhooks received
              </p>
              <p className="text-xl font-semibold">{usage.webhooks24}</p>
            </div>
            <div className="border-neutral-border/60 rounded-lg border bg-black/10 p-3">
              <p className="text-neutral-text-secondary text-xs">
                CRM actions executed
              </p>
              <p className="text-xl font-semibold">{usage.actions24}</p>
            </div>
            <div className="border-neutral-border/60 rounded-lg border bg-black/10 p-3">
              <p className="text-neutral-text-secondary text-xs">
                Rate-limit / circuit events
              </p>
              <p className="text-xl font-semibold">{usage.rateEvents24}</p>
            </div>
          </div>
        </Card>
      )}

      {isManager && workspace.integrations.length > 0 && (
        <Card className="mt-4 space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Integration events</p>
              <p className="text-neutral-text-secondary text-xs">
                Live metadata from the health endpoint. Elite required for
                inbound webhooks.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {workspace.integrations.map((integration) => {
              const health = healthByIntegration.find(
                (h: any) => h.id === integration.id,
              )
              return (
                <div
                  key={integration.id}
                  className="flex flex-col gap-1 rounded-lg border border-neutral-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold capitalize">
                        {integration.provider}
                      </p>
                      <Badge
                        variant={
                          integration.status === 'connected'
                            ? 'green'
                            : integration.status === 'error'
                              ? 'red'
                              : 'gray'
                        }
                      >
                        {integration.status}
                      </Badge>
                    </div>
                    {health?.breakerOpen && (
                      <Badge variant="red">Circuit open</Badge>
                    )}
                  </div>
                  <div className="text-neutral-text-secondary text-xs">
                    Last webhook:{' '}
                    {health?.lastWebhookAt
                      ? new Date(health.lastWebhookAt).toISOString()
                      : '—'}{' '}
                    • Last action:{' '}
                    {health?.lastSuccessfulActionAt
                      ? new Date(health.lastSuccessfulActionAt).toISOString()
                      : '—'}{' '}
                    • Failures: {health?.failures ?? 0}
                  </div>
                  <div className="text-xs text-amber-300">
                    {health?.lastError ? `Last error: ${health.lastError}` : ''}
                    {health?.error ? `Health unavailable: ${health.error}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {elite && isManager && timelineByIntegration.length > 0 && (
        <Card className="mt-4 space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">CRM Activity Timeline</p>
              <p className="text-neutral-text-secondary text-xs">
                Recent CRM events per integration (read-only, audit log
                sourced).
              </p>
            </div>
            <Badge variant="blue">Elite</Badge>
          </div>

          <div className="space-y-3">
            {workspace.integrations.map((integration) => {
              const timeline = timelineByIntegration.find(
                (t) => t.id === integration.id,
              )
              const entries = timeline?.entries ?? []
              return (
                <div
                  key={integration.id}
                  className="border-neutral-border/60 rounded-lg border bg-black/10 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold capitalize">
                        {integration.provider}
                      </p>
                      <Badge variant="gray">{entries.length} events</Badge>
                    </div>
                    <Badge
                      variant={
                        integration.status === 'connected'
                          ? 'green'
                          : integration.status === 'error'
                            ? 'red'
                            : 'gray'
                      }
                    >
                      {integration.status}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <OperatorActions
                      integrationId={integration.id}
                      disabled={!!(integration.metadata as any)?.disabled}
                      onClearCircuit={async (id) => {
                        'use server'
                        await clearCircuitBreaker(id, workspace.id, profile.id)
                        return { ok: true }
                      }}
                      onToggleDisable={async (id) => {
                        'use server'
                        const meta = integration.metadata as any
                        const next = !(meta?.disabled ?? false)
                        await softDisableIntegration(
                          id,
                          workspace.id,
                          next,
                          profile.id,
                        )
                        return { ok: true }
                      }}
                      onReplay={async (id) => {
                        'use server'
                        await rerunLastFailedAction(
                          id,
                          workspace.id,
                          profile.id,
                        )
                        return { ok: true }
                      }}
                    />
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-neutral-text-secondary mt-2 text-[11px]">
                      No CRM events yet for this integration.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="border-neutral-border/60 flex items-start justify-between rounded border bg-slate-900/40 px-3 py-2"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge size="xs" variant="gray">
                                {entry.action}
                              </Badge>
                              <span className="text-neutral-text-secondary text-[10px]">
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-neutral-text-primary text-[11px]">
                              Target: {entry.targetType}
                              {entry.targetId ? ` • ${entry.targetId}` : ''}
                            </div>
                            {entry.meta && (
                              <div className="text-neutral-text-secondary text-[10px]">
                                {JSON.stringify(entry.meta)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </DashboardShell>
  )
}

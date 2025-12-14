// app/dashboard/[workspaceSlug]/protected-layout.tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { protectRoute } from '@/lib/auth/protect'
import { prisma } from '@/lib/db'

type RouteRule = {
  require?: 'Free' | 'Basic' | 'Pro' | 'Elite'
  role?: ('owner' | 'admin' | 'member') | ('owner' | 'admin' | 'member')[]
}

function PlanPill({ plan }: { plan: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
      {plan}
    </span>
  )
}

function RolePill({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
      {role.toUpperCase()}
    </span>
  )
}

export default async function ProtectedLayout({
  children,
  params,
  rules,
}: {
  children: ReactNode
  params: { workspaceSlug: string }
  rules: RouteRule
}) {
  const path = headers().get('x-pathname') ?? ''

  // MASTER GUARD (auth + workspace exists + membership + role + plan)
  const res = await protectRoute(params.workspaceSlug, rules)
  if (!res.allowed || !res.workspace || !res.role || !res.plan) {
    return <meta httpEquiv="refresh" content={`0; url=${res.redirect}`} />
  }
  const workspace = res.workspace
  const role = res.role
  const plan = res.plan

  // Workspace Switcher (server-rendered, no client code needed)
  // Pull all workspaces the user belongs to for "multi-business UX"
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: res.userId },
    select: { id: true },
  })

  const memberships = profile
    ? await prisma.workspaceMember.findMany({
        where: { userId: profile.id },
        select: {
          workspace: { select: { id: true, name: true, slug: true } },
          role: true,
        },
        orderBy: { createdAt: 'asc' },
      })
    : []

  const workspaces = memberships.map((m) => m.workspace)

  const isElite = plan === 'Elite'
  const showAudit = isElite // C) Audit logs gated here (Elite/Enterprise)

  return (
    <div className="min-h-[calc(100vh-0px)]">
      {/* Top context bar (enterprise UX) */}
      <div className="bg-background/60 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Left: Workspace Switcher */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-sm font-semibold">Workspace</div>

            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md border px-3 py-1.5 text-sm">
                <span className="truncate">
                  {workspace.name}{' '}
                  <span className="text-muted-foreground">
                    ({workspace.slug})
                  </span>
                </span>
              </summary>

              <div className="bg-background absolute left-0 z-50 mt-2 w-[320px] overflow-hidden rounded-lg border shadow-lg">
                <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
                  Switch workspace
                </div>

                <div className="max-h-72 overflow-auto">
                  {workspaces.length ? (
                    workspaces.map((w) => (
                      <Link
                        key={w.id}
                        href={`/dashboard/${w.slug}`}
                        className={`hover:bg-muted block px-3 py-2 text-sm ${w.slug === workspace.slug ? 'bg-muted' : ''
                          }`}
                      >
                        <div className="font-medium">{w.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {w.slug}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-muted-foreground px-3 py-3 text-sm">
                      No workspaces found.
                    </div>
                  )}
                </div>

                <div className="border-t p-2">
                  <Link
                    href="/onboarding/create-workspace"
                    className="hover:bg-muted block rounded-md border px-3 py-2 text-center text-sm font-medium"
                  >
                    + Create workspace
                  </Link>
                </div>
              </div>
            </details>
          </div>

          {/* Right: Plan/Role + actions */}
          <div className="flex items-center gap-2">
            <PlanPill plan={res.plan} />
            <RolePill role={res.role} />

            {/* B) Billing Enforcement: Upgrade CTA when not enough plan */}
            {res.plan !== 'Elite' ? (
              <Link
                href={`/dashboard/${params.workspaceSlug}/upsell`}
                className="hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                Upgrade
              </Link>
            ) : null}

            {/* C) Audit Logs entry (Elite/Enterprise) */}
            {showAudit ? (
              <Link
                href={`/dashboard/${params.workspaceSlug}/settings/audit`}
                className="hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                Audit Logs
              </Link>
            ) : null}
          </div>
        </div>

        {/* Optional: context hint for debugging */}
        {path ? (
          <div className="text-muted-foreground mx-auto max-w-6xl px-4 pb-3 text-xs">
            {path}
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  )
}

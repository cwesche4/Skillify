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
  const h = headers()
  const path = h.get('x-pathname') ?? h.get('next-url') ?? ''

  const res = await protectRoute(params.workspaceSlug, rules)
  if (!res.allowed || !res.workspace || !res.role || !res.plan) {
    return <meta httpEquiv="refresh" content={`0; url=${res.redirect}`} />
  }

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
  const isElite = res.plan === 'Elite'

  return (
    <div className="min-h-[calc(100vh-0px)]">
      <div className="bg-background/60 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-sm font-semibold">Workspace</div>

            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md border px-3 py-1.5 text-sm">
                <span className="truncate">
                  {res.workspace.name}{' '}
                  <span className="text-muted-foreground">
                    ({res.workspace.slug})
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
                        className={`hover:bg-muted block px-3 py-2 text-sm ${
                          w.slug === res.workspace.slug ? 'bg-muted' : ''
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

          <div className="flex items-center gap-2">
            <PlanPill plan={res.plan} />
            <RolePill role={res.role} />

            {res.plan !== 'Elite' ? (
              <Link
                href={`/dashboard/${params.workspaceSlug}/upsell`}
                className="hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                Upgrade
              </Link>
            ) : null}

            {isElite ? (
              <Link
                href={`/dashboard/${params.workspaceSlug}/settings/audit`}
                className="hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                Audit Logs
              </Link>
            ) : null}
          </div>
        </div>

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

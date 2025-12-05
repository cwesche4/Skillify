// app/dashboard/automations/[automationId]/compare/page.tsx
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { prisma } from "@/lib/db"

export default async function CompareRunsPage({
  params,
  searchParams,
}: {
  params: { automationId: string }
  searchParams: { a?: string; b?: string }
}) {
  const { automationId } = params

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { id: true, name: true, workspaceId: true },
  })

  if (!automation) return notFound()

  // Two run IDs: ?a=run1&b=run2
  const runA = searchParams.a
    ? await prisma.automationRun.findUnique({
        where: { id: searchParams.a },
        include: { events: true },
      })
    : null

  const runB = searchParams.b
    ? await prisma.automationRun.findUnique({
        where: { id: searchParams.b },
        include: { events: true },
      })
    : null

  const recentRuns = await prisma.automationRun.findMany({
    where: { automationId },
    orderBy: { startedAt: "desc" },
    take: 10,
  })

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-neutral-text-primary text-2xl font-semibold">
            Compare Automation Runs
          </h1>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Select two runs to compare execution differences.
          </p>
        </div>

        <Link
          href={`/dashboard/automations/${automationId}`}
          className="btn btn-secondary"
        >
          Back to Automation
        </Link>
      </header>

      {/* RUN SELECTOR */}
      <Card className="p-4">
        <h2 className="mb-2 text-sm font-medium">Recent runs</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-neutral-text-secondary mb-1 text-xs uppercase">
              Select Run A
            </h3>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`?a=${run.id}${searchParams.b ? `&b=${searchParams.b}` : ""}`}
                  className={`block rounded-lg border p-2 text-sm transition ${
                    runA?.id === run.id
                      ? "bg-brand-primary/10 border-brand-primary"
                      : "hover:bg-neutral-cardDark/40 border-neutral-border"
                  }`}
                >
                  Run {run.id}
                  <Badge className="ml-2 text-xs">{run.status}</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-neutral-text-secondary mb-1 text-xs uppercase">
              Select Run B
            </h3>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`?b=${run.id}${searchParams.a ? `&a=${searchParams.a}` : ""}`}
                  className={`block rounded-lg border p-2 text-sm transition ${
                    runB?.id === run.id
                      ? "bg-brand-primary/10 border-brand-primary"
                      : "hover:bg-neutral-cardDark/40 border-neutral-border"
                  }`}
                >
                  Run {run.id}
                  <Badge className="ml-2 text-xs">{run.status}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* COMPARISON SECTION */}
      {runA && runB ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="text-sm font-medium">
              Run A — <span className="text-brand-primary">{runA.id}</span>
            </h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-cardDark p-3 text-xs">
              {JSON.stringify(runA.events, null, 2)}
            </pre>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-medium">
              Run B — <span className="text-brand-primary">{runB.id}</span>
            </h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-cardDark p-3 text-xs">
              {JSON.stringify(runB.events, null, 2)}
            </pre>
          </Card>
        </div>
      ) : (
        <p className="text-neutral-text-secondary text-sm">
          Select two runs above to view a comparison.
        </p>
      )}
    </div>
  )
}

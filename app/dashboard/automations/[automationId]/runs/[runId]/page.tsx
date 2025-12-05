// app/dashboard/automations/[automationId]/runs/[runId]/page.tsx

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { prisma } from "@/lib/db"

interface PageProps {
  params: { automationId: string; runId: string }
}

interface RunRecord {
  id: string
  status: string
  log: string | null
  startedAt: Date
  finishedAt: Date | null
  automation: {
    id: string
    name: string
  }
}

export default async function RunDetailsPage({ params }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // Fetch run details
  const run: RunRecord | null = await prisma.automationRun.findUnique({
    where: { id: params.runId },
    select: {
      id: true,
      status: true,
      log: true,
      startedAt: true,
      finishedAt: true,
      automation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!run) {
    redirect(`/dashboard/automations/${params.automationId}/runs`)
  }

  const duration =
    run.finishedAt && run.startedAt
      ? `${Math.round(
          (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000,
        )} sec`
      : "—"

  const statusColor =
    run.status === "SUCCESS" ? "green" : run.status === "FAILED" ? "red" : "default"

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h2 flex items-center gap-3">
            Run Details
            <Badge variant={statusColor}>{run.status}</Badge>
          </h1>

          <p className="body text-neutral-text-secondary">
            Automation: <strong>{run.automation.name}</strong>
          </p>

          <p className="text-neutral-text-secondary text-xs">Run ID: {run.id}</p>
        </div>

        <Button
          variant="secondary"
          onClick={() => redirect(`/dashboard/automations/${params.automationId}/runs`)}
        >
          Back to History
        </Button>
      </div>

      {/* SUMMARY CARD */}
      <div className="card grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <p className="text-neutral-text-secondary text-sm">Started</p>
          <p className="font-medium">{new Date(run.startedAt).toLocaleString()}</p>
        </div>

        <div>
          <p className="text-neutral-text-secondary text-sm">Finished</p>
          <p className="font-medium">
            {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"}
          </p>
        </div>

        <div>
          <p className="text-neutral-text-secondary text-sm">Duration</p>
          <p className="font-medium">{duration}</p>
        </div>
      </div>

      {/* LOG VIEWER */}
      <div className="card space-y-3 p-4">
        <h2 className="h4">Execution Log</h2>

        {run.log ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs leading-relaxed">
            {run.log}
          </pre>
        ) : (
          <p className="text-neutral-text-secondary text-sm">No logs recorded.</p>
        )}
      </div>

      {/* TIMELINE CARD */}
      <div className="card space-y-4 p-4">
        <h2 className="h4">Timeline</h2>

        <div className="space-y-3 border-l border-slate-700 pl-4">
          {run.log &&
            run.log.split("\n").map((line: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-xs leading-relaxed">{line}</p>
              </div>
            ))}

          {!run.log && (
            <p className="text-neutral-text-secondary text-sm">Timeline unavailable.</p>
          )}
        </div>
      </div>
    </div>
  )
}

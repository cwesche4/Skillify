// app/dashboard/automations/[automationId]/runs/page.tsx

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/Badge"
import { Table, TBody, THead, TR, TH, TD } from "@/components/ui/Table"
import { prisma } from "@/lib/db"

interface AutomationRunRecord {
  id: string
  status: string
  startedAt: Date
  finishedAt: Date | null
  log: string | null
}

interface AutomationRecord {
  id: string
  name: string
}

interface PageProps {
  params: { automationId: string }
}

export default async function AutomationRunsPage({ params }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // Fetch automation info
  const automation: AutomationRecord | null = await prisma.automation.findUnique({
    where: { id: params.automationId },
    select: { id: true, name: true },
  })

  if (!automation) {
    redirect("/dashboard/automations")
  }

  // Fetch run history
  const runs: AutomationRunRecord[] = await prisma.automationRun.findMany({
    where: { automationId: automation.id },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="h2 flex items-center gap-2">
          Runs: {automation.name}
          <Badge variant="blue" size="sm">
            History
          </Badge>
        </h1>
        <p className="body text-neutral-text-secondary text-sm">
          Recent executions of this automation.
        </p>
      </div>

      {/* TABLE */}
      <div className="card">
        {runs.length === 0 ? (
          <p className="body text-neutral-text-secondary text-sm">
            No runs yet. Execute this automation from the Builder page.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Run ID</TH>
                <TH>Status</TH>
                <TH>Started</TH>
                <TH>Finished</TH>
                <TH>Log</TH>
              </TR>
            </THead>
            <TBody>
              {runs.map((run: AutomationRunRecord) => (
                <TR key={run.id}>
                  <TD className="text-xs">{run.id}</TD>

                  <TD>
                    <Badge
                      variant={
                        run.status === "SUCCESS"
                          ? "green"
                          : run.status === "FAILED"
                            ? "red"
                            : "default"
                      }
                      size="sm"
                    >
                      {run.status}
                    </Badge>
                  </TD>

                  <TD className="text-xs">
                    {run.startedAt instanceof Date
                      ? run.startedAt.toLocaleString()
                      : new Date(run.startedAt).toLocaleString()}
                  </TD>

                  <TD className="text-xs">
                    {run.finishedAt
                      ? run.finishedAt instanceof Date
                        ? run.finishedAt.toLocaleString()
                        : new Date(run.finishedAt).toLocaleString()
                      : "—"}
                  </TD>

                  <TD className="max-w-xs text-xs">
                    <pre className="line-clamp-3 whitespace-pre-wrap">
                      {run.log ?? ""}
                    </pre>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  )
}

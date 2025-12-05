// app/api/command-center/search/route.ts
import { prisma } from "@/lib/db"
import type { AutomationStatus, RunStatus, WorkspaceMemberRole } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

type WorkspaceSearchResult = {
  type: "workspace"
  id: string
  name: string
  slug: string
  createdAt: string
}

type AutomationSearchResult = {
  type: "automation"
  id: string
  name: string
  workspaceId: string
  workspaceName: string
  status: AutomationStatus
  createdAt: string
  lastRunAt: string | null
}

type RunSearchResult = {
  type: "run"
  id: string
  automationId: string
  automationName: string
  workspaceId: string
  workspaceName: string
  status: RunStatus
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
}

type MemberSearchResult = {
  type: "member"
  id: string
  workspaceId: string
  workspaceName: string
  userId: string
  clerkId: string
  role: WorkspaceMemberRole
}

export type CommandSearchResult =
  | WorkspaceSearchResult
  | AutomationSearchResult
  | RunSearchResult
  | MemberSearchResult

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get("q") ?? "").trim()

  if (!query) {
    return NextResponse.json<CommandSearchResult[]>([])
  }

  const q = query.toLowerCase()

  // Workspaces
  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  // Automations
  const automations = await prisma.automation.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
    },
    include: {
      workspace: true,
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    take: 5,
  })

  // Runs
  const runs = await prisma.automationRun.findMany({
    where: {
      log: query ? { contains: q, mode: "insensitive" } : undefined,
    },
    include: {
      automation: {
        include: {
          workspace: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 5,
  })

  // Members
  const members = await prisma.workspaceMember.findMany({
    where: {
      OR: [
        {
          workspace: {
            name: { contains: q, mode: "insensitive" },
          },
        },
        {
          user: {
            clerkId: { contains: q, mode: "insensitive" },
          },
        },
      ],
    },
    include: {
      workspace: true,
      user: true,
    },
    take: 5,
  })

  const workspaceResults: WorkspaceSearchResult[] = workspaces.map((w) => ({
    type: "workspace",
    id: w.id,
    name: w.name,
    slug: w.slug,
    createdAt: w.createdAt.toISOString(),
  }))

  const automationResults: AutomationSearchResult[] = automations.map((a) => ({
    type: "automation",
    id: a.id,
    name: a.name,
    workspaceId: a.workspaceId,
    workspaceName: a.workspace?.name ?? "",
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    lastRunAt: a.runs[0]?.startedAt ? a.runs[0].startedAt.toISOString() : null,
  }))

  const runResults: RunSearchResult[] = runs.map((r) => {
    const durationMs =
      r.finishedAt && r.startedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null

    return {
      type: "run",
      id: r.id,
      automationId: r.automationId,
      automationName: r.automation?.name ?? "",
      workspaceId: r.workspaceId,
      workspaceName: r.automation?.workspace?.name ?? "",
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      durationMs,
    }
  })

  const memberResults: MemberSearchResult[] = members.map((m) => ({
    type: "member",
    id: m.id,
    workspaceId: m.workspaceId,
    workspaceName: m.workspace?.name ?? "",
    userId: m.user?.id ?? "",
    clerkId: m.user?.clerkId ?? "",
    role: m.role,
  }))

  const results: CommandSearchResult[] = [
    ...workspaceResults,
    ...automationResults,
    ...runResults,
    ...memberResults,
  ]

  return NextResponse.json(results)
}

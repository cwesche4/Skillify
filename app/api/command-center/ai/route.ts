// app/api/command-center/ai/route.ts
import { prisma } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// Local types for this endpoint
interface AiCoachContextSummary {
  workspaceId: string
  workspaceName?: string
  automationCount: number
  recentRunCount: number
  successRate?: number
}

interface AiCoachRequestBody {
  workspaceId: string
  question: string
  mode?: "explain" | "optimize" | "insights"
}

interface AiCoachResponseBody {
  answer: string
  context?: AiCoachContextSummary
  suggestions?: string[]
}

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const body = (await req.json()) as AiCoachRequestBody

  if (!body.workspaceId || !body.question) {
    return new NextResponse("workspaceId and question are required", {
      status: 400,
    })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: body.workspaceId },
    select: {
      id: true,
      name: true,
      automations: { select: { id: true }, take: 1 },
      runs: {
        select: { id: true, status: true },
        take: 50,
      },
    },
  })

  if (!workspace) {
    return new NextResponse("Workspace not found", { status: 404 })
  }

  const automationCount = workspace.automations.length
  const recentRunCount = workspace.runs.length

  const successCount = workspace.runs.filter((r) => r.status === "SUCCESS").length
  const successRate =
    recentRunCount > 0 ? (successCount / recentRunCount) * 100 : undefined

  const context: AiCoachContextSummary = {
    workspaceId: workspace.id,
    workspaceName: workspace.name ?? undefined,
    automationCount,
    recentRunCount,
    successRate,
  }

  // TODO: plug in your actual AI model call here
  const answer = "AI Coach is connected. Replace this placeholder with a real LLM call."

  const suggestions: string[] = [
    "Review failed runs over the last 7 days.",
    "Add alerts for repeated failures on key automations.",
    "Split long flows into smaller, reusable sub-flows.",
  ]

  const response: AiCoachResponseBody = {
    answer,
    context,
    suggestions,
  }

  return NextResponse.json(response)
}

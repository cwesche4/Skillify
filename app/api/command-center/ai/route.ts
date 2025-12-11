import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

//
// TYPES
//
type AiCoachMode = 'insights' | 'optimize' | 'explain'

interface AiCoachContextSummary {
  workspaceId: string
  workspaceName: string
  automationCount: number
  recentRunCount: number
  successRate: number | null
}

interface AiCoachRequestBody {
  workspaceId: string
  question: string
  mode?: AiCoachMode
}

interface AiCoachResponseBody {
  answer: string
  mode: AiCoachMode
  context: AiCoachContextSummary
  suggestions: string[]
}

//
// MODE INFERENCE – NLP-based rules
//
function inferMode(question: string): AiCoachMode {
  const q = question.toLowerCase()

  if (q.includes('optimize') || q.includes('improve') || q.includes('better'))
    return 'optimize'
  if (q.includes('explain') || q.includes('meaning') || q.includes('what does'))
    return 'explain'
  if (q.includes('why') || q.includes('trend') || q.includes('what happened'))
    return 'insights'

  return 'insights'
}

//
// PROMPT BUILDER (for future OpenAI integration)
//
function buildPrompt(
  mode: AiCoachMode,
  question: string,
  context: AiCoachContextSummary,
): string {
  const header = `You are Skillify's AI Coach. Mode: ${mode.toUpperCase()}.`
  const ctx = `
Workspace: ${context.workspaceName} (${context.workspaceId})
Automations: ${context.automationCount}
Recent runs: ${context.recentRunCount}
Success rate: ${context.successRate ?? 'N/A'}%
`

  const instructions =
    mode === 'insights'
      ? 'Focus on trends, reliability, anomalies, and high-level performance insights.'
      : mode === 'optimize'
        ? 'Provide clear, actionable optimization suggestions to improve reliability and cost.'
        : 'Explain behavior in simple, understandable language.'

  return `${header}\n${ctx}\nUser Question: "${question}"\nInstructions: ${instructions}`
}

//
// AI COACH ANSWER GENERATOR (deterministic placeholder)
//
async function generateAiCoachAnswer(
  mode: AiCoachMode,
  question: string,
  context: AiCoachContextSummary,
): Promise<{ answer: string; suggestions: string[] }> {
  const prompt = buildPrompt(mode, question, context)

  const intro =
    mode === 'insights'
      ? 'Here are insights based on recent automation activity:'
      : mode === 'optimize'
        ? 'Here are optimization opportunities for your workspace:'
        : 'Here is an explanation based on the workspace data:'

  const suggestions =
    mode === 'insights'
      ? [
        'Review failure spikes in the last 50 runs.',
        'Identify automations with the lowest success rate.',
        'Compare week-over-week reliability trends.',
      ]
      : mode === 'optimize'
        ? [
          'Break large automations into modular sub-flows.',
          'Add retry logic around external integrations.',
          'Improve naming of steps to simplify debugging.',
        ]
        : [
          'Review step-by-step execution logs.',
          'Verify triggers and conditions match expectations.',
          'Document intended automation behavior.',
        ]

  return {
    answer: `${intro}\n\n(Prompt preview — real AI integration coming soon):\n\n${prompt}`,
    suggestions,
  }
}

//
// MAIN HANDLER – POST /api/command-center/ai
//
export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  let body: AiCoachRequestBody
  try {
    body = (await req.json()) as AiCoachRequestBody
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  if (!body.workspaceId || !body.question) {
    return new NextResponse('workspaceId and question are required', {
      status: 400,
    })
  }

  const mode: AiCoachMode = body.mode ?? inferMode(body.question)

  //
  // Verify user profile
  //
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile)
    return new NextResponse('User profile not found', { status: 404 })

  //
  // Verify membership
  //
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: body.workspaceId,
      userId: profile.id,
    },
    select: { id: true },
  })
  if (!membership)
    return new NextResponse('Forbidden: not a workspace member', {
      status: 403,
    })

  //
  // Load workspace + stats
  //
  const workspace = await prisma.workspace.findUnique({
    where: { id: body.workspaceId },
    select: { id: true, name: true },
  })
  if (!workspace)
    return new NextResponse('Workspace not found', { status: 404 })

  const [automationCount, recentRuns] = await Promise.all([
    prisma.automation.count({ where: { workspaceId: body.workspaceId } }),
    prisma.automationRun.findMany({
      where: { workspaceId: body.workspaceId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: { status: true },
    }),
  ])

  const recentRunCount = recentRuns.length
  const successRate =
    recentRunCount > 0
      ? Number(
        (
          (recentRuns.filter((r: any) => r.status === 'SUCCESS').length /
            recentRunCount) *
          100
        ).toFixed(1),
      )
      : null

  const context: AiCoachContextSummary = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    automationCount,
    recentRunCount,
    successRate,
  }

  //
  // Generate AI response (placeholder or real OpenAI later)
  //
  const { answer, suggestions } = await generateAiCoachAnswer(
    mode,
    body.question,
    context,
  )

  const response: AiCoachResponseBody = {
    answer,
    mode,
    context,
    suggestions,
  }

  return NextResponse.json(response)
}

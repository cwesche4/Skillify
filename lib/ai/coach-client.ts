// lib/ai/coach-client.ts

export type AiCoachMode = 'insights' | 'optimize' | 'explain'

export interface AiCoachResult {
  answer: string
  suggestions: string[]
  mode: AiCoachMode
  context: {
    workspaceId: string
    workspaceName: string
    automationCount: number
    recentRunCount: number
    successRate: number | null
  }
}

export async function askAiCoach({
  workspaceId,
  question,
  mode,
}: {
  workspaceId: string
  question: string
  mode?: AiCoachMode
}): Promise<AiCoachResult> {
  const res = await fetch('/api/command-center/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, question, mode }),
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return (await res.json()) as AiCoachResult
}

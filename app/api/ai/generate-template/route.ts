import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

import {
  NODE_DEFINITIONS,
  type BuilderNodeType,
} from '@/lib/builder/node-types'

type TemplateNode = {
  id: string
  type: BuilderNodeType
  position: { x: number; y: number }
  data: Record<string, any>
}

type TemplateEdge = {
  id: string
  source: string
  target: string
  animated?: boolean
}

interface GenerateTemplateBody {
  prompt?: string
}

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: GenerateTemplateBody = {}
  try {
    body = (await req.json()) as GenerateTemplateBody
  } catch {
    // ignore, prompt stays undefined
  }

  const prompt = (body.prompt ?? '').toLowerCase()

  const isOnboarding =
    prompt.includes('onboard') ||
    prompt.includes('welcome') ||
    prompt.includes('onboarding')

  const triggerDef = NODE_DEFINITIONS.trigger
  const llmDef = NODE_DEFINITIONS['ai-llm']
  const webhookDef = NODE_DEFINITIONS.webhook

  const triggerId = 'node-trigger'
  const llmId = 'node-llm'
  const webhookId = 'node-webhook'

  const nodes: TemplateNode[] = [
    {
      id: triggerId,
      type: triggerDef.type,
      position: { x: 0, y: 0 },
      data: {
        label: triggerDef.label,
        ...(triggerDef.defaultData ?? {}),
      },
    },
    {
      id: llmId,
      type: llmDef.type,
      position: { x: 260, y: -40 },
      data: {
        label: isOnboarding ? 'Generate welcome message' : llmDef.label,
        ...(llmDef.defaultData ?? {}),
        prompt: isOnboarding
          ? 'Write a friendly onboarding email for a new customer.'
          : (llmDef.defaultData?.prompt ?? ''),
      },
    },
    {
      id: webhookId,
      type: webhookDef.type,
      position: { x: 520, y: 0 },
      data: {
        label: webhookDef.label,
        ...(webhookDef.defaultData ?? {}),
      },
    },
  ]

  const edges: TemplateEdge[] = [
    {
      id: 'e-trigger-llm',
      source: triggerId,
      target: llmId,
      animated: true,
    },
    {
      id: 'e-llm-webhook',
      source: llmId,
      target: webhookId,
      animated: false,
    },
  ]

  return NextResponse.json({
    template: {
      nodes,
      edges,
    },
  })
}

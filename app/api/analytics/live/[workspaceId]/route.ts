// app/api/analytics/live/[workspaceId]/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requirePlan } from '@/lib/auth/route-guard'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = params

  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
  }

  // 🔒 Pro+ only (analytics live metrics)
  await requirePlan('Pro', workspaceId)

  let interval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: unknown) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      // Initial event so client knows it’s connected
      send({
        type: 'connected',
        workspaceId,
        timestamp: new Date().toISOString(),
      })

      // Simple heartbeat – can be replaced with real analytics later
      interval = setInterval(() => {
        send({
          type: 'heartbeat',
          workspaceId,
          timestamp: new Date().toISOString(),
        })
      }, 5000)
    },

    cancel() {
      if (interval) clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

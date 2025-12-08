// app/api/analytics/live/[workspaceId]/route.ts
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { workspaceId } = params

  let interval: any

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

      // Simple heartbeat – you can later replace with real analytics
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

// app/api/workspaces/[workspaceId]/coach/live/stream/route.ts
import {
  getLiveCoachSnapshot,
  type LiveCoachSnapshot,
} from '@/lib/analytics/liveCoach'

export async function GET(
  _req: Request,
  context: { params: { workspaceId: string } },
) {
  const { workspaceId } = context.params
  const encoder = new TextEncoder()

  let interval: NodeJS.Timeout

  const stream = new ReadableStream({
    async start(controller) {
      async function pushSnapshot() {
        try {
          const snapshot: LiveCoachSnapshot =
            await getLiveCoachSnapshot(workspaceId)

          const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`

          controller.enqueue(encoder.encode(payload))
        } catch (err) {
          console.error('AI Coach SSE snapshot error:', err)
          const payload = `event: error\ndata: "AI Coach error"\n\n`
          controller.enqueue(encoder.encode(payload))
        }
      }

      // send initial snapshot immediately
      await pushSnapshot()

      // then push every 15s
      interval = setInterval(pushSnapshot, 15000)
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
      'X-Accel-Buffering': 'no',
    },
  })
}

// app/api/analytics/stream/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlan } from '@/lib/auth/route-guard'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' })
  }

  // 🔒 Protect analytics SSE – Pro+ only
  await requirePlan('Pro', workspaceId)

  let interval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      async function send() {
        try {
          const runsToday = await prisma.automationRun.count({
            where: {
              workspaceId,
              startedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          })

          const failed = await prisma.automationRun.count({
            where: { workspaceId, status: 'FAILED' },
          })

          const success = await prisma.automationRun.count({
            where: { workspaceId, status: 'SUCCESS' },
          })

          const total = success + failed
          const successRate =
            total === 0 ? 0 : Math.round((success / total) * 100)

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                runsToday,
                failed,
                successRate,
                timestamp: Date.now(),
              })}\n\n`,
            ),
          )
        } catch (err) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${String(err)}\n\n`),
          )
        }
      }

      // send first payload immediately
      await send()
      // then stream every 5s
      interval = setInterval(send, 5000)
    },

    async cancel() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
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

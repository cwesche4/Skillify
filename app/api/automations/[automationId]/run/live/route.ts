// app/api/automations/[automationId]/run/live/route.ts
import { auth } from '@clerk/nextjs/server'

import { executeAutomationLive } from '@/lib/automations/executor'
import { prisma } from '@/lib/db'

interface Params {
  params: { automationId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const automation = await prisma.automation.findUnique({
    where: { id: params.automationId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      flow: true,
    },
  })

  if (!automation) {
    return new Response('Automation not found', { status: 404 })
  }

  const flow = (automation.flow as any) ?? { nodes: [], edges: [] }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      ;(async () => {
        // Create run record
        const runRecord = await prisma.automationRun.create({
          data: {
            automationId: automation.id,
            workspaceId: automation.workspaceId,
            status: 'RUNNING',
            log: '',
          },
        })

        send('runStart', {
          runId: runRecord.id,
          automationId: automation.id,
          name: automation.name,
        })

        try {
          // Execute flow node-by-node using live runner
          const { success, log } = await executeAutomationLive(
            prisma,
            runRecord.id,
            flow,
            async (evt: any) => {
              // Save node-end events
              if (evt.kind === 'nodeEnd') {
                await prisma.automationRunEvent.create({
                  data: {
                    runId: evt.runId,
                    nodeId: evt.nodeId,
                    nodeType: evt.nodeType,
                    status: evt.status,
                    message: evt.message,
                    path: evt.path ?? null,
                  },
                })
              }

              // Stream to frontend
              send('node', evt)
            },
          )

          // Finish run
          await prisma.automationRun.update({
            where: { id: runRecord.id },
            data: {
              status: success ? 'SUCCESS' : 'FAILED',
              log,
              finishedAt: new Date(),
            },
          })

          send('runEnd', {
            runId: runRecord.id,
            success,
            log,
          })
        } catch (err: any) {
          await prisma.automationRun.update({
            where: { id: runRecord.id },
            data: {
              status: 'FAILED',
              log: err?.message ?? 'Unknown live run error',
              finishedAt: new Date(),
            },
          })

          send('error', {
            runId: runRecord.id,
            message: err?.message ?? 'Unknown error',
          })
        } finally {
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}

// app/api/automations/[automationId]/run/live/route.ts
import { authorizeAutomationAccess } from '@/lib/automations/authorization'
import { executeAutomationLive } from '@/lib/automations/executor'
import { prisma } from '@/lib/db'
import { getAdvancedAutomationMutationError } from '@/lib/automations/policy'

interface Params {
  params: { automationId: string }
}

export async function GET(_req: Request, { params }: Params) {
  const access = await authorizeAutomationAccess({
    automationId: params.automationId,
    access: 'manage',
  })
  if (!access.allowed) {
    return new Response(access.message, { status: access.status })
  }

  const ownershipError = getAdvancedAutomationMutationError(
    Boolean(access.automation.managedBySimple),
  )
  if (ownershipError) {
    return new Response(ownershipError, { status: 409 })
  }

  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: access.automation.workspaceId,
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      status: true,
      flow: true,
    },
  })

  if (!automation) {
    return new Response('Automation not found', { status: 404 })
  }
  if (automation.status !== 'ACTIVE') {
    return new Response('Automation is not active', { status: 409 })
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
            {
              workspaceId: automation.workspaceId,
              automationId: automation.id,
              userProfileId: access.userProfileId,
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

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'

const PayloadSchema = z.object({
  workspaceId: z.string().optional(),
  automationId: z.string().optional(),
  nodeType: z.string().optional(),
  tab: z.string().optional(),
  dockSide: z.string().optional(),
  widthPreset: z.string().optional(),
  mode: z.string().optional(),
  fieldsChanged: z.array(z.string()).optional(),
  timestamp: z.number().optional(),
})

const EventSchema = z.object({
  event: z.string(),
  payload: PayloadSchema,
})

const BodySchema = z.object({
  events: z.array(EventSchema).min(1),
})

const MAX_BATCH = 100

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ ok: true, stored: 0 })
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: true, stored: 0 })
  }

  const trimmedEvents = parsed.data.events.slice(0, MAX_BATCH)

  const eventsWithWorkspace = trimmedEvents.filter((e) => e.payload.workspaceId)
  if (!eventsWithWorkspace.length) {
    return NextResponse.json({ ok: true, stored: 0 })
  }

  const workspaceIds = Array.from(
    new Set(eventsWithWorkspace.map((e) => e.payload.workspaceId!)),
  )

  const memberships = await prisma.workspaceMember.findMany({
    where: { workspaceId: { in: workspaceIds }, user: { clerkId } },
    select: { workspaceId: true },
  })
  const allowed = new Set(memberships.map((m) => m.workspaceId))
  if (!allowed.size) {
    return NextResponse.json({ ok: true, stored: 0 })
  }

  const toStore = eventsWithWorkspace.filter((e) =>
    allowed.has(e.payload.workspaceId!),
  )
  if (!toStore.length) {
    return NextResponse.json({ ok: true, stored: 0 })
  }

  const data = toStore.map(({ event, payload }) => {
    const base: any = {
      event,
      workspaceId: payload.workspaceId,
      automationId: payload.automationId,
      nodeType: payload.nodeType,
      payload,
    }
    if (payload.timestamp) {
      base.createdAt = new Date(payload.timestamp)
    }
    return base
  })

  // TODO: remove `as any` once Prisma Client is regenerated with the telemetry model
  const client = prisma as any
  await client.inspectorTelemetryEvent.createMany({ data })

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[InspectorTelemetry] stored events', toStore.length)
  }

  return NextResponse.json({ ok: true, stored: toStore.length })
}

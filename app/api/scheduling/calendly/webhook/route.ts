// app/api/scheduling/calendly/webhook/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CalendarProvider, BookingStatus } from '@prisma/client'

export async function POST(req: Request) {
  try {
    // NOTE: For production, validate Calendly signature headers here.
    const payload = await req.json()

    const eventType = payload.event
    const data = payload.payload

    // Example: "invitee.created"
    if (eventType === 'invitee.created') {
      const start = new Date(data.event.start_time)
      const end = new Date(data.event.end_time)
      const email = data.invitee.email
      const name = data.invitee.name

      // You could look up workspace + bookingType based on event URI, routing rules, etc.
      // For now, we map to a default workspace/booking type if exists.
      const workspace = await prisma.workspace.findFirst({
        where: { slug: 'skillify-hq' },
      })

      if (!workspace) return NextResponse.json({ ok: true })

      const bookingType = await prisma.bookingType.findFirst({
        where: { workspaceId: workspace.id, slug: 'enterprise-demo' },
      })

      if (!bookingType) return NextResponse.json({ ok: true })

      await prisma.booking.create({
        data: {
          workspaceId: workspace.id,
          bookingTypeId: bookingType.id,
          status: BookingStatus.CONFIRMED,
          provider: CalendarProvider.CALENDLY,
          start,
          end,
          timezone: data.event.timezone,
          guestName: name,
          guestEmail: email,
          source: 'calendly',
          externalEventId: data.event.uuid,
          externalUrl: data.event.uri,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[calendly webhook] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

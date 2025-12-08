// app/api/scheduling/google/webhook/route.ts

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // Google Calendar push notifications are usually handled via channel IDs + sync tokens.
    // For now, this is a placeholder so you have the endpoint wired up.
    const headers = Object.fromEntries(req.headers)
    const bodyText = await req.text()

    console.log('[Google Calendar webhook] headers', headers)
    console.log('[Google Calendar webhook] body', bodyText)

    // You would:
    // 1. Look up which CalendarAccount this channel corresponds to
    // 2. Call Google Calendar API with the sync token
    // 3. Upsert ExternalCalendarEvent + Booking mappings

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[google webhook] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

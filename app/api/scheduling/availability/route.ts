import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { addMinutes, isAfter } from 'date-fns'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { bookingTypeId, startDate, endDate } = body

  const bookingType = await prisma.bookingType.findUnique({
    where: { id: bookingTypeId },
    include: {
      availabilityWindows: true,
      bookings: true,
    },
  })

  if (!bookingType)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const timezone = bookingType.timezone
  const duration = bookingType.durationMinutes

  const windows = bookingType.availabilityWindows

  const slots: { start: string; end: string }[] = []

  for (const w of windows) {
    const current = new Date(startDate)
    const until = new Date(endDate)

    while (isAfter(until, current)) {
      if (w.dayOfWeek !== current.getDay()) {
        current.setDate(current.getDate() + 1)
        continue
      }

      const start = new Date(current)
      start.setHours(0, 0, 0, 0)
      start.setMinutes(w.startTimeMinutes)

      const end = new Date(current)
      end.setHours(0, 0, 0, 0)
      end.setMinutes(w.endTimeMinutes)

      const blockEnd = addMinutes(start, duration)

      if (blockEnd <= end) {
        slots.push({
          start: start.toISOString(),
          end: blockEnd.toISOString(),
        })
      }

      current.setDate(current.getDate() + 1)
    }
  }

  return NextResponse.json({ slots })
}

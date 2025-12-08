// lib/scheduling/availability.ts

import { prisma } from '@/lib/db'
import { BookingStatus } from '@prisma/client'

export type AvailabilitySlot = {
  start: string // ISO
  end: string // ISO
  available: boolean
}

type GetAvailabilityArgs = {
  workspaceId: string
  bookingTypeSlug: string
  from: Date
  to: Date
}

export async function getAvailability({
  workspaceId,
  bookingTypeSlug,
  from,
  to,
}: GetAvailabilityArgs): Promise<AvailabilitySlot[]> {
  const bookingType = await prisma.bookingType.findFirst({
    where: { workspaceId, slug: bookingTypeSlug, isActive: true },
    include: {
      availabilityWindows: true,
      bookings: {
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          start: { gte: from },
          end: { lte: to },
        },
      },
    },
  })

  if (!bookingType) return []

  const slots: AvailabilitySlot[] = []

  // Very simple: assume a fixed set of 60-min slots based on windows
  const duration = bookingType.durationMinutes
  const bufferBefore = bookingType.bufferBefore ?? 0
  const bufferAfter = bookingType.bufferAfter ?? 0

  const busyIntervals = bookingType.bookings.map((b) => ({
    start: b.start.getTime() - bufferBefore * 60_000,
    end: b.end.getTime() + bufferAfter * 60_000,
  }))

  const tz = bookingType.timezone

  // Iterate days between from/to
  const cursor = new Date(from)
  while (cursor <= to) {
    const dayOfWeek = cursor.getUTCDay() // 0–6
    const dateStr = cursor.toISOString().split('T')[0]

    const windows = bookingType.availabilityWindows.filter((w) => {
      if (w.dateOverride) {
        const overrideStr = w.dateOverride.toISOString().split('T')[0]
        return overrideStr === dateStr
      }
      return w.dayOfWeek === dayOfWeek
    })

    for (const win of windows) {
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`).getTime()
      const startMinutes = win.startTimeMinutes
      const endMinutes = win.endTimeMinutes

      for (
        let m = startMinutes;
        m + duration <= endMinutes;
        m += duration + bufferAfter
      ) {
        const start = dayStart + m * 60_000
        const end = start + duration * 60_000

        const overlapsBusy = busyIntervals.some(
          (b) => !(end <= b.start || start >= b.end),
        )

        if (!overlapsBusy) {
          slots.push({
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            available: true,
          })
        }
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return slots
}

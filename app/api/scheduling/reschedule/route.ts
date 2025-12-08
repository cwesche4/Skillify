import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { token, newStart, newEnd } = await req.json()

  const tokenRecord = await prisma.rescheduleToken.findUnique({
    where: { token },
    include: { booking: true },
  })

  if (!tokenRecord)
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  const updated = await prisma.booking.update({
    where: { id: tokenRecord.bookingId },
    data: {
      start: new Date(newStart),
      end: new Date(newEnd),
      status: 'CONFIRMED',
    },
  })

  return NextResponse.json({ updated })
}
